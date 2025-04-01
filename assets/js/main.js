const teams = [
    {
        teamId: "T001",
        teamName: "Global Operations",
        region: "Global",
        manager: "Jane Smith",
        parentTeam: "-"
      },
      {
        teamId: "T002",
        teamName: "Africa Programs",
        region: "Africa",
        manager: "John Doe",
        parentTeam: "Global Operations"
      },
      {
        teamId: "T003",
        teamName: "Asia Programs",
        region: "Asia",
        manager: "Sarah Wong",
        parentTeam: "Global Operations"
      },
      {
        teamId: "T004",
        teamName: "Kenya Projects",
        region: "Kenya",
        manager: "Alice Johnson",
        parentTeam: "Africa Programs"
      },
      {
        teamId: "T006",
        teamName: "Nairobi Initiative",
        region: "Nairobi",
        manager: "Bob Williams",
        parentTeam: "Kenya Projects"
      },
      {
        teamId: "T007",
        teamName: "India Programs",
        region: "India",
        manager: "Raj Patel",
        parentTeam: "Asia Programs"
      },
      {
        teamId: "T008",
        teamName: "Delhi Projects",
        region: "Delhi",
        manager: "Priya Sharma",
        parentTeam: "India Programs"
      },
      {
        teamId: "T009",
        teamName: "Mumbai Projects",
        region: "Mumbai",
        manager: "Arjun Singh",
        parentTeam: "India Programs"
      }
  ];
let drawnFeatures = [] 
let hoveredFeatureId = null;
$(document).ready(function() {
    
    const $select = $('#team-select');
    // Append new options
    teams.forEach(team => {
      $select.append(
        $('<option>', {
          value: team.teamId,
          text: team.teamName
        })
      );
    });
    // Initialize the map
    const map = new maplibregl.Map({
        container: 'map',
        style: {
            version: 8,
            sources: {
                'osm-tiles': {
                    type: 'raster',
                    tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', 
                            'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png', 
                            'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    attribution: '© OpenStreetMap Contributors'
                },
                'satellite-tiles': {
                    type: 'raster',
                    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                    tileSize: 256,
                    attribution: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community'
                }
            },
            layers: [
                {
                    id: 'osm-layer',
                    type: 'raster',
                    source: 'osm-tiles',
                    layout: {
                        visibility: 'visible'
                    }
                },
                {
                    id: 'satellite-layer',
                    type: 'raster',
                    source: 'satellite-tiles',
                    layout: {
                        visibility: 'none'
                    }
                }
            ]
        },
        center: [107.6, -6.9], // Indonesia's approximate coordinates
        zoom: 6
    });
    const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
            polygon: true,
            trash: true
        },
        styles: [
            // ACTIVE (being drawn)
            // line stroke
            {
                "id": "gl-draw-line",
                "type": "line",
                "filter": ["all", ["==", "$type", "LineString"]],
                "layout": {
                  "line-cap": "round",
                  "line-join": "round"
                },
                "paint": {
                  "line-color": "#D20C0C",
                  "line-dasharray": [0.2, 2],
                  "line-width": 2
                }
            },
            // polygon fill
            {
              "id": "gl-draw-polygon-fill",
              "type": "fill",
              "filter": ["all", ["==", "$type", "Polygon"]],
              "paint": {
                "fill-color": "#19647e",
                "fill-outline-color": "#D20C0C",
                "fill-opacity": 0.9
              }
            },
            // polygon mid points
            {
              'id': 'gl-draw-polygon-midpoint',
              'type': 'circle',
              'filter': ['all',
                ['==', '$type', 'Point'],
                ['==', 'meta', 'midpoint']],
              'paint': {
                'circle-radius': 3,
                'circle-color': '#fbb03b'
              }
            },
            // polygon outline stroke
            // This doesn't style the first edge of the polygon, which uses the line stroke styling instead
            {
              "id": "gl-draw-polygon-stroke-active",
              "type": "line",
              "filter": ["all", ["==", "$type", "Polygon"]],
              "layout": {
                "line-cap": "round",
                "line-join": "round"
              },
              "paint": {
                "line-color": "#D20C0C",
                "line-dasharray": [0.2, 2],
                "line-width": 2
              }
            },
            // vertex point halos
            {
              "id": "gl-draw-polygon-and-line-vertex-halo-active",
              "type": "circle",
              "filter": ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]],
              "paint": {
                "circle-radius": 5,
                "circle-color": "#FFF"
              }
            },
            // vertex points
            {
              "id": "gl-draw-polygon-and-line-vertex-active",
              "type": "circle",
              "filter": ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]],
              "paint": {
                "circle-radius": 3,
                "circle-color": "#D20C0C",
              }
            }
          ]
    });
    map.addControl(draw, 'top-right');

    map.on('draw.create', function(e) {
        // Get the drawn polygon
        const drawnPolygon = e.features[0];
        
        // Process the drawn polygon
        processDrawnPolygon(drawnPolygon);
        
        // Reset the drawing mode
        draw.deleteAll();
        selecting = false;
        $('#select-button').text('Draw Area').removeClass('btn-danger').addClass('btn-primary');
    });

    function processDrawnPolygon(drawnPolygon) {
    $('#loading').show();
    try {
        // Get all features from the geojson source that intersect with the drawn polygon
        const features = map.querySourceFeatures('geojson-source');
        const intersectingFeatures = [];
        
        // Create Sets to track unique address values
        const uniqueAddresses = new Set();
        
        // For each feature, check if it intersects with the drawn polygon
        features.forEach(feature => {
            try {
                feature.properties['address'] = 'Kec: ' + feature.properties.WADMKC + 
                                              ', Kab: ' + feature.properties.WADMKK + 
                                              ', Prov: ' + feature.properties.WADMPR + 
                                              ', Indonesia';
                
                // Check for intersection using Turf.js
                const intersection = turf.booleanIntersects(feature, drawnPolygon);
                
                if (intersection) {
                    // Add to intersecting features (for properties only)
                    intersectingFeatures.push(feature);
                    
                    // Add address to the unique set
                    if (feature.properties.address) {
                        uniqueAddresses.add(feature.properties.address);
                    }
                }
            } catch (error) {
                console.error('Error checking intersection:', error, feature);
            }
        });
        
        // Get the selected team
        const selectedTeamId = $('#team-select').val();
        let selectedTeamName = "-", selectedTeamParent = "";
        
        // Find the team name from the teams array
        if (selectedTeamId) {
            const selectedTeam = teams.find(team => team.teamId === selectedTeamId);
            if (selectedTeam) {
                selectedTeamName = selectedTeam.teamName;
                selectedTeamParent = selectedTeam.parentTeam;
            }
        }
        
        // Create a new feature with the team assignment
        const newFeature = {
            type: 'Feature',
            geometry: drawnPolygon.geometry,
            properties: {
                teamId: selectedTeamId,
                teamName: selectedTeamName,
                teamParent: selectedTeamParent,
                area_km2: turf.area(drawnPolygon) / 1000000, // Convert m² to km²
                perimeter_km: turf.length(turf.polygonToLine(drawnPolygon)) / 1000, // Convert m to km
                addr: [...uniqueAddresses].join('|'),
                id: 'area_' + (drawnFeatures.length + 1) // Generate a unique ID
            }
        };
        
        // Add to our array of drawn features
        drawnFeatures.push(newFeature);
        
        // Update the display
        displayAllDrawnFeatures();
        
        // Show "Add Another Area" button after first area is drawn
        if (drawnFeatures.length === 1) {
            addAddAnotherAreaButton();
        }
        
        // Enable PDF button
        $('#pdf-button').prop('disabled', false);
        
        alert(`Successfully created working area for ${selectedTeamName}!`);
    } catch (error) {
        console.error('Error processing polygon:', error);
        alert('Error processing polygon: ' + error.message);
    }
    
    $('#loading').hide();
    }
    function addAddAnotherAreaButton() {
        // Check if button already exists
        if ($('#add-area-button').length === 0) {
            const newButton = $('<div class="col-12 mt-1 d-grid gap-2">' +
                '<button class="btn btn-sm btn-info position-relative" id="add-area-button">' +
                'Add Another Area' +
                '</button>' +
                '</div>');
            
            $('#merge-button-container').append(newButton);
            
            // Add click handler for the new button
            $('#add-area-button').click(function() {
                // Reset selection state
                selecting = true;
                
                // Change select button text
                $('#select-button').text('Cancel Drawing').removeClass('btn-primary')
                    .addClass('btn-danger');
                
                // Start polygon drawing mode
                draw.changeMode('draw_polygon');
            });
        }
    }
    function displayAllDrawnFeatures() {
        // Reset selection state when redisplaying features
        selectedFeatureIndex = null;
        $('#remove-selected-area').prop('disabled', true);
        updateSelectedAreaIndicator(null);
        
        // If drawn features source already exists, update it
        if (map.getSource('drawn-features-source')) {
            map.getSource('drawn-features-source').setData({
                type: 'FeatureCollection',
                features: drawnFeatures.map((feature, index) => {
                    // Ensure each feature has a numeric ID for feature-state to work
                    return {
                        ...feature,
                        id: index // Add numeric id property for feature-state
                    };
                })
            });
        } else {
            // Add drawn features source and layers
            map.addSource('drawn-features-source', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: drawnFeatures.map((feature, index) => {
                        // Ensure each feature has a numeric ID for feature-state to work
                        return {
                            ...feature,
                            id: index // Add numeric id property for feature-state
                        };
                    })
                }
            });
            
            // Add fill layer for drawn features
            map.addLayer({
                id: 'drawn-features-fill',
                type: 'fill',
                source: 'drawn-features-source',
                paint: {
                    'fill-color': '#19647E',
                    'fill-opacity': 0.7
                }
            });
            
            // Add outline for drawn features
            map.addLayer({
                id: 'drawn-features-line',
                type: 'line',
                source: 'drawn-features-source',
                paint: {
                    'line-color': '#006400',
                    'line-width': 1
                }
            });
            
            // Add a hover effect
            map.addLayer({
                id: 'drawn-features-hover',
                type: 'fill',
                source: 'drawn-features-source',
                paint: {
                    'fill-color': '#28AFB0',
                    'fill-opacity': [
                        'case',
                        ['boolean', ['feature-state', 'hover'], false],
                        1,
                        0
                    ]
                }
            });
            
        }
        
        // Remove previous handlers to avoid duplicates
        map.off('mousemove', 'drawn-features-fill');
        map.off('mouseleave', 'drawn-features-fill');
        map.off('click', 'drawn-features-fill');
        
        // Add hover interaction
        map.on('mousemove', 'drawn-features-fill', (e) => {
            if (e.features.length > 0) {
                map.getCanvas().style.cursor = 'pointer';
                
                // Clear previous hover state if it exists
                if (hoveredFeatureId !== null) {
                    map.setFeatureState(
                        { source: 'drawn-features-source', id: hoveredFeatureId },
                        { hover: false }
                    );
                }
                
                // Get the feature id (which is the array index we set earlier)
                hoveredFeatureId = e.features[0].id;
                
                // Set new hover state
                map.setFeatureState(
                    { source: 'drawn-features-source', id: hoveredFeatureId },
                    { hover: true }
                );
            }
        });
        
        map.on('mouseleave', 'drawn-features-fill', () => {
            map.getCanvas().style.cursor = '';
            
            // Clear hover state when mouse leaves the layer
            if (hoveredFeatureId !== null) {
                map.setFeatureState(
                    { source: 'drawn-features-source', id: hoveredFeatureId },
                    { hover: false }
                );
                hoveredFeatureId = null;
            }
        });
        
        // Add click interaction for selection
        map.on('click', 'drawn-features-fill', (e) => {
            if (e.features.length > 0) {
                // Get the property ID from the feature
                const propertyId = e.features[0].properties.id;
                
                // Find the index in our array
                const featureIndex = drawnFeatures.findIndex(f => f.properties.id === propertyId);
                
                if (featureIndex !== -1) {
                    // Toggle selection
                    if (selectedFeatureIndex === featureIndex) {
                        // Deselect if already selected
                        selectedFeatureIndex = null;
                        updateSelectedAreaIndicator(null);
                        $('#remove-selected-area').prop('disabled', true);
                    } else {
                        // Select new feature
                        selectedFeatureIndex = featureIndex;
                        updateSelectedAreaIndicator(featureIndex);
                        $('#remove-selected-area').prop('disabled', false);
                    }
                }
            }
        });
    }
    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    
    // Store GeoJSON data and selected features
    let selectedFeatures = [];
    let mergedFeature = null;
    let selecting = false;
    // Load GeoJSON data
    function loadGeoJSON() {
        $('#loading').show();
        // Add the source
        map.addSource('geojson-source', {
            type: 'geojson',
            data: kec_boundaries
        });
        
        // Add fill layer
        map.addLayer({
            id: 'geojson-fill',
            type: 'fill',
            source: 'geojson-source',
            paint: {
                'fill-color': [
                    'case',
                    ['in', ['get', 'id'], ['literal', selectedFeatures.map(f => f.properties.id)]],
                    '#ff9e00',
                    '#0080ff'
                ],
                'fill-opacity': 0
            }
        });
        
        // Add line layer
        map.addLayer({
            id: 'geojson-line',
            type: 'line',
            source: 'geojson-source',
            paint: {
                'line-color': '#000',
                'line-width': .5
            }
        });
        
        // Fit map to GeoJSON bounds
        if (kec_boundaries.features.length > 0) {
            const bounds = turf.bbox(kec_boundaries);
            map.fitBounds([
                [bounds[0], bounds[1]],
                [bounds[2], bounds[3]]
            ], { padding: 50 });
        }
        $('#loading').hide();
    }
    // Add a container for the area list after the map controls
    $(`<div id="remove-list-container" class="container">
  <div class="d-flex justify-content-between align-items-center mb-2">
    <h5>Working Areas</h5>
    <button id="remove-selected-area" class="btn btn-sm btn-danger" disabled>Remove Selected</button>
  </div>
  <div id="selected-area-indicator" class="alert alert-info mb-2" style="display:none;">No area selected</div>
  <ul id="area-list" class="list-group"></ul>
  <button id="clear-all-areas" class="btn btn-sm btn-outline-danger mt-2" style="display:none;">Clear All Areas</button>
</div>`)
          .insertAfter('#merge-button-container');
          
      // Add click handler for the remove selected area button
      $('#remove-selected-area').click(function() {
          if (selectedFeatureIndex !== null) {
              removeArea(selectedFeatureIndex);
              selectedFeatureIndex = null;
              $(this).prop('disabled', true);
              updateSelectedAreaIndicator(null);
          }
      });
      
      // Add function to update the area list
      function updateAreaList() {
          const $areaList = $('#area-list');
          $areaList.empty();
          
          if (drawnFeatures.length === 0) {
              $areaList.append('<li class="list-group-item text-muted">No areas drawn yet</li>');
              return;
          }
          
          drawnFeatures.forEach((feature, index) => {
              const $item = $(`<li class="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                      <strong>${feature.properties.teamName}</strong>
                      <br>
                      <small>Area: ${feature.properties.area_km2.toFixed(2)} km²</small>
                  </div>
                  <div>
                      <button class="btn btn-sm btn-outline-danger remove-area" data-index="${index}">
                          <i class="bi bi-trash"></i> Remove
                      </button>
                  </div>
              </li>`);
              
              $areaList.append($item);
          });
          
          // Add event handlers for remove buttons
          $('.remove-area').click(function() {
              const index = $(this).data('index');
              removeArea(index);
          });
      }
      
      // Function to remove an area
      function removeArea(index) {
          if (confirm(`Are you sure you want to remove the area for ${drawnFeatures[index].properties.teamName}?`)) {
              drawnFeatures.splice(index, 1);
              
              // Update the display
              displayAllDrawnFeatures();
              updateAreaList();
              
              // If no areas left, disable PDF button and remove "Add Another Area" button
              if (drawnFeatures.length === 0) {
                  $('#pdf-button').prop('disabled', true);
                  $('#add-area-button').parent().remove();
              }
              
              // Reset selection state if needed
              if (selectedFeatureIndex === index) {
                  selectedFeatureIndex = null;
                  $('#remove-selected-area').prop('disabled', true);
                  updateSelectedAreaIndicator(null);
              } else if (selectedFeatureIndex > index) {
                  // Adjust selection index if a feature with lower index was removed
                  selectedFeatureIndex--;
                  updateSelectedAreaIndicator(selectedFeatureIndex);
              }
          }
      }
      
      // Function to update the selected area indicator
      function updateSelectedAreaIndicator(index) {
          const $indicator = $('#selected-area-indicator');
          
          if (index === null) {
              $indicator.text('No area selected').hide();
              return;
          }
          
          const feature = drawnFeatures[index];
          $indicator.html(`Selected: <strong>${feature.properties.teamName}</strong> (${feature.properties.area_km2.toFixed(2)} km²)`).show();
      }
      
      // Update the area list when features change
      const originalProcessDrawnPolygon = processDrawnPolygon;
      processDrawnPolygon = function(drawnPolygon) {
          originalProcessDrawnPolygon(drawnPolygon);
          updateAreaList();
      };
      
      // Initialize the area list
      updateAreaList();
      
      // Add a "Clear All Areas" button for convenience
      $('<button id="clear-all-areas" class="btn btn-sm btn-outline-danger mt-2">Clear All Areas</button>')
          .appendTo('#area-list')
          .hide()  // Hide initially
          .click(function() {
              if (confirm('Are you sure you want to remove all drawn areas?')) {
                  drawnFeatures = [];
                  displayAllDrawnFeatures();
                  updateAreaList();
                  $('#pdf-button').prop('disabled', true);
                  $('#add-area-button').parent().remove();
                  $(this).hide();
              }
          });
      
      // Show the Clear All button when there are areas
      const originalUpdateAreaList = updateAreaList;
      updateAreaList = function() {
          originalUpdateAreaList();
          if (drawnFeatures.length > 0) {
              $('#clear-all-areas').show();
          } else {
              $('#clear-all-areas').hide();
          }
      };
    // Handle click on features
    const geoFillClicked=function(e) {
        if (e.features.length > 0) {
            const feature = e.features[0];
            const featureId = feature.properties.id;
            
            // Toggle selection
            const index = selectedFeatures.findIndex(f => f.properties.id === featureId);
            
            if (index === -1) {
                // Add to selection
                selectedFeatures.push(feature);
            } else {
                // Remove from selection
                selectedFeatures.splice(index, 1);
            }
        }
    }
    
    
    // Change cursor on hover
    map.on('mouseenter', 'geojson-fill', function() {
        map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', 'geojson-fill', function() {
        map.getCanvas().style.cursor = '';
    });
    
    $('#select-button').click(function(){
        selecting = !selecting;
        
        if (selecting) {
            // Entering drawing mode
            // Remove any previous click handler for direct selection
            map.off('click', 'geojson-fill', geoFillClicked);
            
            // Change button text
            $(this).text('Cancel Drawing').removeClass('btn-primary')
                .addClass('btn-danger');
            
            // Start polygon drawing mode
            draw.changeMode('draw_polygon');
        } else {
            // Canceling drawing mode
            draw.deleteAll();
            
            // Change button text back
            $(this).text('Draw Area').removeClass('btn-danger')
                .addClass('btn-primary');
            
            // If no areas are drawn, disable the PDF button
            if (drawnFeatures.length === 0) {
                $('#pdf-button').prop('disabled', true);
                
                // Remove drawn features if they exist
                if (map.getSource('drawn-features-source')) {
                    map.removeLayer('drawn-features-hover');
                    map.removeLayer('drawn-features-fill');
                    map.removeLayer('drawn-features-line');
                    map.removeSource('drawn-features-source');
                }
            }
        }
    });
    // PDF Export function with dedicated map canvas
    // Enhanced PDF Export function with team name title and deduplicated kab values
    $('#pdf-button').click(function() {
        if (drawnFeatures.length === 0) {
            alert('Please create at least one working area before generating reports.');
            return;
        }
        
        $('#loading').show();
        
        try {
            // Create a new jsPDF instance
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Generate a report for each drawn feature
            generateReports(doc, 0, function() {
                // When all reports are generated, save the PDF with timestamp
                const now = new Date();
                const timestamp = now.getFullYear().toString() +
                                (now.getMonth() + 1).toString().padStart(2, '0') +
                                now.getDate().toString().padStart(2, '0') +
                                '_' +
                                now.getHours().toString().padStart(2, '0') +
                                now.getMinutes().toString().padStart(2, '0') +
                                now.getSeconds().toString().padStart(2, '0');
                                
                // Save PDF with timestamp in filename
                doc.save(`working_areas_report_${timestamp}.pdf`);
                
                $('#loading').hide();
            });
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error generating PDF: ' + error.message);
            $('#loading').hide();
        }
    });
    function generateReports(doc, index, callback) {
        // If we've processed all features, call the callback
        if (index >= drawnFeatures.length) {
            callback();
            return;
        }
        
        // Add a new page for each feature except the first one
        if (index > 0) {
            doc.addPage();
        }
        
        // Get the current feature
        const feature = drawnFeatures[index];
        
        // Create a temporary div for the map
        const tempMapDiv = document.createElement('div');
        tempMapDiv.id = `pdf-map-container-${index}`;
        tempMapDiv.style.width = '800px';
        tempMapDiv.style.height = '600px';
        tempMapDiv.style.position = 'absolute';
        tempMapDiv.style.left = '-9999px';  // Position off-screen
        document.body.appendChild(tempMapDiv);
        
        // Create a new map instance for PDF export
        const pdfMap = new maplibregl.Map({
            container: `pdf-map-container-${index}`,
            style: {
                version: 8,
                sources: {
                    'osm-tiles': {
                        type: 'raster',
                        tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', 
                                'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png', 
                                'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        attribution: '© OpenStreetMap Contributors'
                    }
                },
                layers: [
                    {
                        id: 'osm-layer',
                        type: 'raster',
                        source: 'osm-tiles',
                        layout: {
                            visibility: 'visible'
                        }
                    }
                ]
            },
            center: map.getCenter(),
            zoom: map.getZoom()
        });
        
        // When the map is loaded, add the feature and capture it
        pdfMap.on('load', function() {
            // Add feature source and layer
            pdfMap.addSource('feature-source', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [feature]
                }
            });
            
            // Add fill layer
            pdfMap.addLayer({
                id: 'feature-fill',
                type: 'fill',
                source: 'feature-source',
                paint: {
                    'fill-color': '#19647E',
                    'fill-opacity': 0.7
                }
            });
            
            // Add outline
            pdfMap.addLayer({
                id: 'feature-line',
                type: 'line',
                source: 'feature-source',
                paint: {
                    'line-color': '#006400',
                    'line-width': 2
                }
            });
            
            // Fit map to feature bounds
            const bounds = turf.bbox(feature);
            pdfMap.fitBounds([
                [bounds[0], bounds[1]],
                [bounds[2], bounds[3]]
            ], { padding: 50 });
            
            // Wait for map to render completely
            setTimeout(function() {
                // Capture the map canvas
                const mapCanvas = pdfMap.getCanvas();
                const mapImage = mapCanvas.toDataURL('image/png');
                
                // Add title with team name
                const pdfTitle = `Working Area of ${feature.properties.teamName}`;
                doc.setFontSize(18);
                doc.text(pdfTitle, 105, 20, { align: 'center' });
                
                // Add map screenshot
                const imgWidth = 180;
                const imgHeight = (mapCanvas.height * imgWidth) / mapCanvas.width;
                doc.addImage(mapImage, 'PNG', 14, 30, imgWidth, Math.min(imgHeight, 100));
                
                // Add feature attributes table
                doc.setFontSize(14);
                doc.text('Working Attributes', 14, Math.min(imgHeight, 100) + 45);
                
                // Prepare table data
                const tableData = [];
                tableData.push(['Parent Team', feature.properties.teamParent]);
                tableData.push(['Team', feature.properties.teamName]);
                
                // Process the properties
                Object.entries(feature.properties).forEach(([key, value]) => {
                    // Skip team properties already added
                    if (key === 'teamId' || key === 'teamName' || key === 'teamParent' || key === 'id') {
                        return;
                    }
                    
                    // Format numbers to 2 decimal places
                    if (typeof value === 'number') {
                        tableData.push([key, value.toFixed(2)]);
                    } 
                    else if(key === 'addr'){
                        let addrValues = value.split('|');
                        // Format as a simple list with bullet points and line breaks
                        let formattedAddrs = addrValues.map(addr => `• ${addr.trim()}`).join('\n');
                        
                        tableData.push(['Admins', formattedAddrs]);
                    }
                    // Handle other properties normally
                    else {
                        tableData.push([key, value]);
                    }
                });
                
                // Generate table
                doc.autoTable({
                    startY: Math.min(imgHeight, 100) + 50,
                    body: tableData,
                    theme: 'striped',
                    styles: {
                        overflow: 'linebreak',
                        cellWidth: 'auto'
                    },
                    columnStyles: {
                        0: { fontStyle: 'bold' },
                        1: { cellWidth: 'auto' }
                    }
                });
                
                // Clean up
                pdfMap.remove();
                document.body.removeChild(tempMapDiv);
                
                // Process the next feature
                generateReports(doc, index + 1, callback);
            }, 1000);
        });
    }
    // Handle basemap selection
    $('#basemap-select').change(function() {
        const basemap = $(this).val();
        
        if (basemap === 'osm') {
            map.setLayoutProperty('osm-layer', 'visibility', 'visible');
            map.setLayoutProperty('satellite-layer', 'visibility', 'none');
        } else if (basemap === 'satellite') {
            map.setLayoutProperty('osm-layer', 'visibility', 'none');
            map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
        }
    });
    
    // Handle layer toggle
    $('#layer-toggle').change(function() {
        const isVisible = $(this).is(':checked');
        
        if (map.getLayer('geojson-fill')) {
            map.setLayoutProperty('geojson-fill', 'visibility', isVisible ? 'visible' : 'none');
            // map.setLayoutProperty('geojson-line', 'visibility', isVisible ? 'visible' : 'none');
        }
    });
    
    // Wait for map to load before adding GeoJSON
    map.on('load', function() {
        loadGeoJSON();
    });
});

// Add this JavaScript to make containers collapsible on mobile

$(document).ready(function() {
    // Add toggle buttons for mobile view
    setupResponsiveContainers();
    
    // Handle window resize
    $(window).resize(function() {
        updateContainerVisibility();
    });
    
    // Update the header with the count of areas whenever drawnFeatures changes
    // We'll use a MutationObserver to watch for changes to the area list
    setupAreaListObserver();
    
    // Make sure the area list container has the correct ID
    $('.container.mt-3:contains("Working Areas")').attr('id', 'remove-list-container');
});

function setupResponsiveContainers() {
    // Add toggle buttons for the control containers
    $('.map-control-container').after('<div class="collapse-toggle left"><i class="bi bi-chevron-left"></i></div>');
    $('#remove-list-container').after('<div class="collapse-toggle right"><i class="bi bi-chevron-right"></i></div>');
    
    // Click handlers for the toggle buttons
    $('.collapse-toggle.left').click(function() {
        $('.map-control-container').toggleClass('collapsed');
        $(this).find('i').toggleClass('bi-chevron-left bi-chevron-right');
    });
    
    $('.collapse-toggle.right').click(function() {
        $('#remove-list-container').toggleClass('collapsed right');
        $(this).find('i').toggleClass('bi-chevron-right bi-chevron-left');
    });
    
    // Initial visibility based on screen size
    updateContainerVisibility();
}

function updateContainerVisibility() {
    // For smaller screens, start with panels collapsed
    if ($(window).width() <= 768) {
        if (!$('.collapse-toggle').is(':visible')) {
            $('.collapse-toggle').show();
        }
    } else {
        // For larger screens, ensure panels are visible and toggle buttons are hidden
        $('.map-control-container, #remove-list-container').removeClass('collapsed right');
        $('.collapse-toggle').hide();
    }
}

function setupAreaListObserver() {
    // Find the area list element
    const areaList = document.getElementById('area-list');
    
    // If it exists, set up an observer to watch for changes
    if (areaList) {
        // Function to update the header with the count
        function updateAreaHeader() {
            const count = window.drawnFeatures ? window.drawnFeatures.length : 0;
            const headerText = count > 0 ? `Working Areas (${count})` : 'Working Areas';
            $('#remove-list-container .d-flex h5').text(headerText);
        }
        
        // Initial update
        updateAreaHeader();
        
        // Create a MutationObserver to watch for changes to the list
        const observer = new MutationObserver(function(mutations) {
            updateAreaHeader();
        });
        
        // Start observing the list for changes
        observer.observe(areaList, { 
            childList: true,
            subtree: true,
            attributes: true
        });
        
        // Also update when drawnFeatures array changes
        // We'll check periodically since we might not have direct access to the update event
        setInterval(function() {
            // Only update if the count has changed
            const count = window.drawnFeatures ? window.drawnFeatures.length : 0;
            const currentHeaderText = $('#remove-list-container .d-flex h5').text();
            const expectedText = count > 0 ? `Working Areas (${count})` : 'Working Areas';
            
            if (currentHeaderText !== expectedText) {
                updateAreaHeader();
            }
        }, 1000); // Check every second
    }
}