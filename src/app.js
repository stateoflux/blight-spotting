
"use strict";

var bs = {
  config: {
    scf_list_url: [
      "http://seeclickfix.com/api/issues.json?",
      "lat=37.7953637",
      "&lng=-122.2711137",
      "&zoom=10",
      "&start=720",
      "&end=0",
      "&page=1",
      "&num_results=1000",
      "&search=illegal+dumping",
      "&sort=issues.created_at",
      "&callback=?"
    ],
    $issue_tooltip: $('#issue-tooltip'),
  },

  getIssues: function() {
    return $.getJSON(bs.config.scf_list_url.join(""));
  },
};

var initialize = function() {
  var issues = null;
  var mapOptions = {
    center: new google.maps.LatLng(37.7953637, -122.2711137),
    zoom: 13
  };
  var map = new google.maps.Map(document.getElementById("map-canvas"),
    mapOptions);
  var gettingIssues = bs.getIssues();

  gettingIssues.then(function(data) {
    issues = data;
    addIssuesToCrossfilter(issues);
    addIssues(map, issues);
  }, function() {
    console.log("Ajax error!");
  });
};

google.maps.event.addDomListener(window, 'load', initialize);

// Load the station data. When the data comes back, create an overlay.
function addIssues(map, issues) {
  var overlay = new google.maps.OverlayView();

  // Add the container when the overlay is added to the map.
  console.log(issues);
  overlay.onAdd = function() {
    var layer = d3.select(this.getPanes().overlayImage).append("div")
      .attr("class", "issues");

    overlay.draw = function() {
      console.log("draw method called", this);

      var projection = this.getProjection(),
        padding = 10;

      var marker = layer.selectAll("svg")
          .data(d3.entries(issues.slice(0,100)))
          .each(transform) // up, issuesdate existing markers
        .enter().append("svg:svg")
          .each(transform)
          .attr("class", "marker");

      // Add a circle.
      marker.append("svg:circle")
          .attr("opacity", 0.0)
          .attr("r", 7)
          .attr("cx", padding)
          .attr("cy", padding)
          .transition()
          .duration(500)
          .attr("opacity", 1.0);

      // Terribly hacky code!!!
      // wam: for some reason, the tooltip code only seems to work within
      // the draw method.
      // ----------------------------------------------------------------------
      var circles = d3.selectAll("svg");
      console.log(circles);
      circles.on("click", function(d) {
        var issueTemplate = Handlebars.compile(bs.config.$issue_tooltip.html());
        var tmpl = issueTemplate({
          address: d.value.address,
          description: d.value.description,
          created_at: d.value.created_at
        });
        // remove previous template if present
        $('.issue-details').remove(); 

        // Can I add tooltips to overlay via jquery?
        // wam: YES!!!!!!
        $('.issues').append(tmpl);
        console.log(d3.select(".issue-details").style("top"));

        // more hacky ass code
        // --------------------------------------------------------------------
        var coords = new google.maps.LatLng(d.value.lat, d.value.lng);
        var pixels = projection.fromLatLngToDivPixel(coords);
        // --------------------------------------------------------------------
        d3.select(".issue-details")
          .style("left", (pixels.x - 125) + "px")
          .style("top",  (pixels.y - 100) + "px")
          .classed("hidden", false);
        console.log("I've been clicked!", d);
      }); // end of marker onclick handler
      // ----------------------------------------------------------------------
      function transform(d) {
        d = new google.maps.LatLng(d.value.lat, d.value.lng);
        d = projection.fromLatLngToDivPixel(d);
        // console.log(d);
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
  var ymdFormat = d3.time.format("%m/%d/%Y - %I:%M%p");
  console.log(ymdFormat.parse(issues[0].created_at));
  issues.forEach(function(i) {
    i.created_at = ymdFormat.parse(i.created_at);
    i.updated_at = ymdFormat.parse(i.updated_at);
  });

  var issue = crossfilter(issues);
  var all = issue.groupAll();
  var date = issue.dimension(function(d) { return d.created_at; });
  var dates = date.group(d3.time.day);
  var status = issue.dimension(function(d) { return d.status; });
  var statuses = status.group();
  var summary = issue.dimension(function(d) { return d.summary; });
  var summaries = summary.group();
  // how do I sort this grouping by date?
  // console.log(dates.top(30)); 
  // console.log(statuses.top(10));
  // console.log(summaries.top(10));
  barChart(dates.top(30));
};

function barChart(dataset) {
  console.log(dataset);
//Width and height
  var margin = {top: 10, right: 10, bottom: 25, left: 30};
  var w = 800 - margin.left - margin.right;
  var h = 120 - margin.top - margin.bottom;
  var barPadding = 1;

  // Scales and Axes
  var x = d3.time.scale()
    .domain([new Date(2013, 10, 17), new Date(2013, 11, 17)])
    .rangeRound([0, w])

  var y = d3.scale.linear()
    .domain([0, d3.max(dataset, function(d) { return d.value; })])
    .range([h, 0]);

  var xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom");

  var yAxis = d3.svg.axis()
      .scale(y)
      .orient("left")
  
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
      .call(yAxis)
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("Issues Reported");

  svg.selectAll(".bar")
      .data(dataset)
    .enter().append("rect")
      .attr("class", "bar")
      .attr("x", function(d) { return x(d.key); })
      .attr("width", w / dataset.length - barPadding)
      .attr("y", function(d) { return y(d.value); })
      .attr("height", function(d) { return h - y(d.value); });

}


//Width and height
      var w = 500;
      var h = 100;
      var barPadding = 1;
      
      var dataset = [ 5, 10, 13, 19, 21, 25, 22, 18, 15, 13,
              11, 12, 15, 20, 18, 17, 16, 18, 23, 25 ];
      
      //Create SVG element
      var svg = d3.select("body")
            .append("svg")
            .attr("width", w)
            .attr("height", h);

      svg.selectAll("rect")
         .data(dataset)
         .enter()
         .append("rect")
         .attr("x", function(d, i) {
            return i * (w / dataset.length);
         })
         .attr("y", function(d) {
            return h - (d * 4);
         })
         .attr("width", w / dataset.length - barPadding)
         .attr("height", function(d) {
            return d * 4;
         })
         .attr("fill", "teal");








