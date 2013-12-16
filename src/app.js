
// Create the Google Map…

var initialize = function() {
  var mapOptions = {
    center: new google.maps.LatLng(37.7953637, -122.2711137),
    zoom: 8
  };
  var map = new google.maps.Map(document.getElementById("map-canvas"),
    mapOptions);
    addStations(map);
};

google.maps.event.addDomListener(window, 'load', initialize);

// Load the station data. When the data comes back, create an overlay.
function addStations(map) {
  d3.json("stations.json", function(data) {

    // wam: what is happening here?
    // creation of a custom overlay.  overlays are objects on a map that are
    // tied to lat/long coordinates.  these objects will stay fixed on map, so will move when map is moved
    // according to api docs, i actually should be sub-classing the Overview class.
    var overlay = new google.maps.OverlayView();

    // Add the container when the overlay is added to the map.
    overlay.onAdd = function() {

      // wam: what does this code expect "this" refer to here?
      // "this" should refer to the overlayView object, but is that truly the case?
      // 
      console.log("add event detected", this);
      // wam: the "panes" of a map specify a stacking order. since we're creating
      // an ground overlay we should attach our custom d3 layer to 
      // the overlayLayer object.
      var layer = d3.select(this.getPanes().overlayLayer).append("div")
          .attr("class", "stations");

      // Draw each marker as a separate SVG element.
      // We could use a single SVG, but what size would it have?
      // wam: who calls the draw function?
      // here we are overiding the empty draw method of the OverlayView class with out own
      // custom method.  This draw method will be called when "add" event fires.
      overlay.draw = function() {
      console.log("draw method called", this);

        // wam:  retrieve the MapCanvasProjection, this will allow us
        // to convert the markers lat/lon value to a pixel value within
        // the maps bounding box. 
        var projection = this.getProjection(),
            padding = 10;

        var marker = layer.selectAll("svg")
            .data(d3.entries(data))
            .each(transform) // update existing markers
          .enter().append("svg:svg")
            .each(transform)
            .attr("class", "marker");

        // Add a circle.
        marker.append("svg:circle")
            .attr("r", 4.5)
            .attr("cx", padding)
            .attr("cy", padding);

        // Add a label.
        marker.append("svg:text")
            .attr("x", padding + 7)
            .attr("y", padding)
            .attr("dy", ".31em")
            .text(function(d) { return d.key; });

        function transform(d) {
          d = new google.maps.LatLng(d.value[1], d.value[0]);
          d = projection.fromLatLngToDivPixel(d);
          console.log(d);
          return d3.select(this)
              .style("left", (d.x - padding) + "px")
              .style("top", (d.y - padding) + "px");
        }
      };
    };

    // Bind our overlay to the map…
    overlay.setMap(map);
  });
}
