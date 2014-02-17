
"use strict";

var bs = {
  config: {
    $container: $('#container-main'),
    $timeline: $('#timeline'),
    // TODO: convert scf_list_url to an object to make config easier
    scf_list_url: [
      "http://seeclickfix.com/api/v2/issues?",
      "lat=37.7953637",
      "&lng=-122.2711137",
      "&zoom=10",
      "&start=720",
      "&end=0",
      "&page=1",
      "&per_page=100",
      "&num_results=100",
      "&search=illegal+dumping",
      "&sort=issues.created_at",
      "&callback=?"
    ],
    $issue_tooltip: $('#issue-tooltip'),
    $issue_image: $('#issue-image'),
    spinner: [
      '<div>',
      '<div class="ui-spinner">',
      '<span class="side side-left">',
      '<span class="fill"></span>',
      '</span>',
      '<span class="side side-right">',
      '<span class="fill"></span>',
      '</span>',
      '</div>',
      '</div>'
    ]
  },

  getIssues: function() {

    // Seeclickfix's api only allows for up to 100 issues to be requested
    // for any api call. This means I have to keep making calls until
    // I have 30 days worth of issues.
    var thirtyDaysFromToday = new Date(new Date() - 30*24*60*60*1000);
    var d = jQuery.Deferred();
    var issues = [];

    var get100Issues = function(page, deferred) {
      bs.config.scf_list_url[6] = "&page=" + page;

      $.getJSON(bs.config.scf_list_url.join(""))
        .done(function(data) {
          // debugger;
          issues = issues.concat(data.issues);
          if (new Date(issues[issues.length - 1].created_at) <= thirtyDaysFromToday) {

            // determine index of 30th day in issues array and slice
            var issues30Days = _.filter(issues, function(issue) {
              return new Date(issue.created_at) >= thirtyDaysFromToday;
            });

            // resolve the defered and pass in the augmented issues array.
            deferred.resolve(issues30Days);
          } else {
            get100Issues(++page, deferred);
          }
        })
        .fail(function(status) {
          deferred.reject(status);
        });
    };

    get100Issues(1, d);
    return d.promise();
  }
};

var initialize = function() {
  bs.config.$timeline.hide();
  // bs.showHideSpinner();
  var issues = null;

  // TODO: refactor map creation logic into a function
  var mapOptions = {
    center: new google.maps.LatLng(37.7953637, -122.2711137),
    zoom: 13
  };
  var map = new google.maps.Map(document.getElementById("map-canvas"),
    mapOptions);

  // initiate AJAX call to seeclickfix api to request issues
  // apply crossfilter to issue to group the number of issues by days
  // create geo-visualization with issue data
  bs.getIssues()
    .then(function(data) {
      console.log(data);
      issues = data;
      addIssuesToCrossfilter(issues);
      addIssues(map, issues);
    }, function() {
      console.log("Ajax error!");
    });
};

// On load event initialize the app
google.maps.event.addDomListener(window, 'load', initialize);

// I'm creating a custom Google Map overlay (objects such as lines or markers) 
// which is where I will add the D3 generated issue markers.
function addIssues(map, issues) {
  var overlay = new google.maps.OverlayView();

  // Google Map's API will call the onAdd and draw methods at appropriate
  // times during the overlay object's init cycle.

  // Attach the chart container to the overlayImage pane (panes are DOM nodes that
  // specify the stacking order of map layers) once the overlay is added to the map.
  overlay.onAdd = function() {
    var layer = d3.select(this.getPanes().overlayImage).append("div")
      .attr("class", "issues");

    // TODO: refactor out the marker generation logic
    // Draw each marker as a separate SVG element.
    overlay.draw = function() {

      // TODO: understand the purpose of the projection and padding
      // Retrieve the overlay's MapCanvasProjection using getProjection() 
      var projection = this.getProjection();
      var padding = 10;

      var marker = layer.selectAll("svg")
          .data(d3.entries(issues.slice(0,100)))  // why am i using d3.entries here?
          .each(transform)  // update existing markers (transform is defined below)
        .enter().append("svg:svg")  // what is this syntax
          .each(transform)
          .attr("class", "marker");

      // Add a circle.
      marker.append("svg:circle")
          .attr("opacity", 0.0)
          .attr("r", 9.5)
          .attr("cx", padding)
          .attr("cy", padding)
          .transition()
          .duration(500)
          .attr("opacity", 1.0);

      // wam: for some reason, the tooltip code only seems to work within
      // the draw method.
      // ----------------------------------------------------------------------
      var markers = d3.selectAll("circle");

      markers.on("click", function(d) {
        var coords = null;
        var pixel = null;

        // request issue details
        var gettingIssueDetails = $.getJSON("http://seeclickfix.com/api/v2/issues/" + d.value.id +
          "?details=true&callback=?");
          
        var issueTemplate = Handlebars.compile(bs.config.$issue_tooltip.html());
        var tmpl = issueTemplate({
          address: d.value.address,
          description: d.value.description,
          created_at: d.value.created_at.toLocaleString("en-US", options)
        });

        var options = {
          weekday: "short", year: "numeric", month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit"
        };
        
        // remove previous template if present
        $('.issue-details').remove();
        $('.issues').append(tmpl);
        coords = new google.maps.LatLng(d.value.lat, d.value.lng);
        pixel = projection.fromLatLngToDivPixel(coords);

        var tooltip = document.querySelector(".issue-details");
        tooltip.style.left = pixel.x - 125 + "px";
        tooltip.style.top = pixel.y - tooltip.clientHeight - 25 + "px";
        tooltip.classList.remove("hidden");

        // issue image viewer
        gettingIssueDetails
          .done(function(data) {
            console.log("issue detail", data.media.image_full);

            var issueDetailTemplate = Handlebars.compile(bs.config.$issue_image.html());
            var issueDetail = issueDetailTemplate({
              description: data.description,
              imgUrl: "http://seeclickfix.com" + data.media.image_full
            });

            console.log("template", issueDetail);
            $('.issue-image-shell').remove();
            $('#issue-detail').append(issueDetail);
          })
          .fail(function(status) {
            console.log("issue request failed: " + status);
          });


      }); // end of marker onclick handler
      // ----------------------------------------------------------------------

      // 
      function transform(d) {
        d = new google.maps.LatLng(d.value.lat, d.value.lng);

        // converts the issue's lat/lng value to a point on the screen
        d = projection.fromLatLngToDivPixel(d);
        
        // shift the marker svg container such that the pixel representing the lat/lng
        // is centered within
        return d3.select(this)
          .style("left", (d.x - padding) + "px")
          .style("top", (d.y - padding) + "px");
      }
    }; // end of draw
  }; // end of onAdd
  // Bind our overlay to the map…
  overlay.setMap(map);
}

function addIssuesToCrossfilter(issues) {
  // console.log("addIssuesToCrossfilter", issues);

  // format of issue.created_at property is in ISO8601 format (2014-02-13T15:51:14-10:00)
  // I need to convert this string into a date object
  issues.forEach(function(i) {
    i.created_at = new Date(i.created_at);
    i.updated_at = new Date(i.updated_at);
  });

  var issuesCf = crossfilter(issues);

  // create a dimension based on the created_at date
  var issuesByDate = issuesCf.dimension(function(d) { return d.created_at; });

  // groups all issues with the same date into buckets.
  // bucket (actually an object), has a key prop which is the created_at date
  // and a value prop that is the number of issues created on that date
  var issueGroupsByDate = issuesByDate.group(d3.time.day);

  // var issuesByStatus = issuesCf.dimension(function(d) { return d.status; });
  // var statuses = status.group();
  // var issuesBySummary = issuesCf.dimension(function(d) { return d.summary; });
  // var summaries = summary.group();
  // how do I sort this grouping by date?
  console.log("last 30", issueGroupsByDate.top(30));
  // console.log(statuses.top(10)); 
  // console.log(summaries.top(10));
  barChart(issueGroupsByDate.top(30));
}

function barChart(dataset) {
  console.log("barChart dataset", dataset);
//Width and height
  var margin = {top: 20, right: 30, bottom: 25, left: 30};
  var w = 740 - margin.left - margin.right;
  var h = 120 - margin.top - margin.bottom;
  var barPadding = 2;

  // the dataset is sorted by number of issues and not by date
  var sortedDataset = dataset.sort(function(a, b) {
    return a.key - b.key;
  });

  console.log(sortedDataset);

  // Scales and Axes
  var x = d3.time.scale()
    .domain([dataset[0].key, dataset[dataset.length - 1].key])
    // .domain([new Date(2013, 10, 16), new Date(2014, 1, 15)])
    // .nice(d3.time.day)
    .rangeRound([0, w]);

  var y = d3.scale.linear()
    .domain([0, d3.max(dataset, function(d) { return d.value; })])
    .range([h, 0]);

  var xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom");

  var yAxis = d3.svg.axis()
      .scale(y)
      .orient("left");
  
  //Create SVG element
  var svg = d3.select("#timeline").append("svg")
    .attr("width", w + margin.left + margin.right)
    .attr("height", h + margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // x-axis
  svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + h + ")")
    .call(xAxis);

  // y-axis
  var yPadding = 0;
  svg.append("g")
      .attr("class", "y axis")
      .attr("transform", "translate(" + yPadding + ",0)")
      .call(yAxis);

  svg.append("text")
    .attr("x", 10)
    .attr("y", 0)
    .attr("font-family", "Helvetica")
    .attr("font-size", "13")
    .text("Number of Illegal Dumping Issues Reported To SeeClickFix");

  svg.selectAll(".bar")
      .data(dataset)
    .enter().append("rect")
      .attr("class", "bar")
      .attr("x", function(d) { return x(d.key); })
      .attr("width", w / dataset.length - barPadding)
      .attr("y", function(d) { return y(d.value); })
      .attr("height", function(d) { return h - y(d.value); });

  bs.config.$timeline.fadeIn();

}



