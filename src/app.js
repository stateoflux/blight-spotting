
"use strict";

var bs = {
  config: {
    scf_list_url: [
      "http://seeclickfix.com/api/issues.json?",
      // "at=Oakland,+CA",
      "lat=37.7953637",
      "&lng=-122.2711137",
      "&zoom=10",
      "&start=168",
      "&end=0",
      "&page=1",
      "&num_results=200",
      "&search=illegal+dumping",
      "&status[Closed]=true",
      "&sort=issues.created_at",
      "&callback=?"
    ]
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
    var layer = d3.select(this.getPanes().overlayLayer).append("div")
        .attr("class", "issues");

    overlay.draw = function() {
      console.log("draw method called", this);

      var projection = this.getProjection(),
        padding = 10;

      var marker = layer.selectAll("svg")
          .data(d3.entries(issues))
          .each(transform) // up, issuesdate existing markers
        .enter().append("svg:svg")
          .each(transform)
          .attr("class", "marker");

      // Add a circle.
      marker.append("svg:circle")
          .attr("r", 6)
          .attr("cx", padding)
          .attr("cy", padding);

      // Add a label.
      marker.append("svg:text")
          .attr("x", padding + 7)
          .attr("y", padding)
          .attr("dy", ".31em")
          .text(function(d) { return d.key; });

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
  var issue = crossfilter(issues);
  var all = issue.groupAll();
  var zipcode = issue.dimension(function(d) { return d.address.slice(-10, -5); });
  var zipcodes = zipcode.group(function(d) { });
};



