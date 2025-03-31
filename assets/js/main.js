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
        }
    });
    map.addControl(draw, 'top-right');

    map.on('draw.create', function(e) {
        // Get the drawn polygon
        const drawnPolygon = e.features[0];
        
        // Process the drawn polygon and find intersecting features (for properties only)
        processDrawnPolygon(drawnPolygon);
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
            
            // Use ONLY the drawn polygon for geometry
            mergedFeature = {
                type: 'Feature',
                geometry: drawnPolygon.geometry, // Use the drawn polygon's geometry directly
                properties: {
                    area_km2: turf.area(drawnPolygon) / 1000000, // Convert m² to km²
                    perimeter_km: turf.length(turf.polygonToLine(drawnPolygon)) / 1000, // Convert m to km
                    // Include properties from intersecting features for reference only
                    // kec: [...new Set(intersectingFeatures.map(f => f.properties.WADMKC || '').filter(Boolean))].join(', '),
                    // kab: [...new Set(intersectingFeatures.map(f => f.properties.WADMKK || '').filter(Boolean))].join(', '),
                    // Convert the Set to an array and join with |
                    addr: [...uniqueAddresses].join('|')
                }
            };
            
            // Update the map with the drawn feature
            displayDrawnFeature();
            
            // Enable PDF button
            $('#pdf-button').prop('disabled', false);
            
            // Update the selection for visualization
            selectedFeatures = intersectingFeatures;
            
            alert(`Successfully create working area!`);
        } catch (error) {
            console.error('Error processing polygon:', error);
            alert('Error processing polygon: ' + error.message);
        }
        
        $('#loading').hide();
    }
    
    // Function to display the drawn feature
    function displayDrawnFeature() {
        if (!mergedFeature) return;
        
        // If merged source already exists, update it
        if (map.getSource('merged-source')) {
            map.getSource('merged-source').setData({
                type: 'FeatureCollection',
                features: [mergedFeature]
            });
        } else {
            // Add drawn feature source and layers
            map.addSource('merged-source', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [mergedFeature]
                }
            });
            
            // Add fill layer for drawn feature
            map.addLayer({
                id: 'merged-fill',
                type: 'fill',
                source: 'merged-source',
                paint: {
                    'fill-color': '#32CD32',
                    'fill-opacity': 0
                }
            });
            
            // Add outline for drawn feature
            map.addLayer({
                id: 'merged-line',
                type: 'line',
                source: 'merged-source',
                paint: {
                    'line-color': '#006400',
                    'line-width': 0.6
                }
            });
        }
    }
    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    
    // Add scale control
    const scale = new maplibregl.ScaleControl({
        maxWidth: 100,
        unit: 'metric'
    });
    map.addControl(scale, 'bottom-left');
    
    // Update scale display
    map.on('move', function() {
        const scaleValue = Math.round(map.getZoom() < 0 ? 0 : Math.pow(2, map.getZoom()) * 74);
        $('#scale-value').text(scaleValue.toLocaleString());
    });
    
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
            selectedFeatures = [];
            
            // Change button text back
            $(this).text('Draw Selection').removeClass('btn-danger')
                .addClass('btn-primary');
            
            // Remove merged feature if it exists
            if (map.getSource('merged-source')) {
                map.removeLayer('merged-fill');
                map.removeLayer('merged-line');
                map.removeSource('merged-source');
                mergedFeature = null;
            }
            
            // Disable PDF button
            $('#pdf-button').prop('disabled', true);
        }
    });
    // PDF Export function with dedicated map canvas
    // Enhanced PDF Export function with team name title and deduplicated kab values
$('#pdf-button').click(function() {
    if (!mergedFeature) {
        alert('Please merge features first before generating a PDF.');
        return;
    }
    
    $('#loading').show();
    
    // Get the selected team name for the title
    const selectedTeamId = $('#team-select').val();
    let selectedTeamName = "-",selectedTeamParent=null
    // Find the team name from the teams array
    if (selectedTeamId) {
        const selectedTeam = teams.find(team => team.teamId === selectedTeamId);
        if (selectedTeam) {
            selectedTeamName = selectedTeam.teamName;
            selectedTeamParent = selectedTeam.parentTeam;
        }
    }
    
    // Create the title with the team name
    const pdfTitle = `Working Area of ${selectedTeamName}`;
    
    try {
        // Create a new temporary div for the PDF map
        const tempMapDiv = document.createElement('div');
        tempMapDiv.id = 'pdf-map-container';
        tempMapDiv.style.width = '800px';
        tempMapDiv.style.height = '600px';
        tempMapDiv.style.position = 'absolute';
        tempMapDiv.style.left = '-9999px';  // Position off-screen
        document.body.appendChild(tempMapDiv);
        
        // Create a new map instance for PDF export
        const pdfMap = new maplibregl.Map({
            container: 'pdf-map-container',
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
        
        // When the new map is loaded, add the merged feature and capture it
        pdfMap.on('load', function() {
            // Add merged feature source and layers to the PDF map
            pdfMap.addSource('merged-source', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [mergedFeature]
                }
            });
            
            // Add fill layer for merged feature
            pdfMap.addLayer({
                id: 'merged-fill',
                type: 'fill',
                source: 'merged-source',
                paint: {
                    'fill-color': '#32CD32',
                    'fill-opacity': 0.6
                }
            });
            
            // Add outline for merged feature
            pdfMap.addLayer({
                id: 'merged-line',
                type: 'line',
                source: 'merged-source',
                paint: {
                    'line-color': '#006400',
                    'line-width': 2
                }
            });
            
            // Fit the map to the merged feature bounds
            const bounds = turf.bbox(mergedFeature);
            pdfMap.fitBounds([
                [bounds[0], bounds[1]],
                [bounds[2], bounds[3]]
            ], { padding: 50 });
            
            // Wait for map to render completely after the fitBounds completes
            setTimeout(function() {
                // Capture the map canvas
                const mapCanvas = pdfMap.getCanvas();
                const mapImage = mapCanvas.toDataURL('image/png');
                
                // Create PDF using jsPDF
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                
                // Add title with team name
                doc.setFontSize(18);
                doc.text(pdfTitle, 105, 20, { align: 'center' });
                
                // Add map screenshot to PDF
                const imgWidth = 180;
                const imgHeight = (mapCanvas.height * imgWidth) / mapCanvas.width;
                doc.addImage(mapImage, 'PNG', 14, 30, imgWidth, Math.min(imgHeight, 100));
                
                // Add caption
                // Add feature attributes table
                doc.setFontSize(14);
                doc.text('Working Attributes', 14, Math.min(imgHeight, 100) + 45);
                
                // Find the team name from the teams array
                
                const tableData = [];
                tableData.push(['Parent Team',selectedTeamParent])
                tableData.push(['Team',selectedTeamName])
                // Process the properties
                Object.entries(mergedFeature.properties).forEach(([key, value]) => {
                    // Format numbers to 2 decimal places
                    if (typeof value === 'number') {
                        tableData.push([key, value.toFixed(2)]);
                    } 
                    else if(key==='addr'){
                        let addrValues = value.split('|');
                        // Format as a simple list with bullet points and line breaks
                        let formattedAddrs = addrValues.map(addr => `• ${addr.trim()}`).join('\n');
                        
                        tableData.push(['Admins', formattedAddrs]);
                    }
                    // Deduplicate comma-separated values for kab and kec
                    // else if (key === 'kab' || key === 'kec') {
                    //     if (typeof value === 'string') {
                    //         // Split by comma, trim whitespace, filter out empty values, and deduplicate
                    //         const uniqueValues = [...new Set(
                    //             value.split(',')
                    //                  .map(v => v.trim())
                    //                  .filter(v => v !== '')
                    //         )];
                    //         // Join back with commas
                    //         tableData.push([key, uniqueValues.join(', ')]);
                    //     } else {
                    //         tableData.push([key, value]);
                    //     }
                    // } 
                    // Handle other properties normally
                    else {
                        tableData.push([key, value]);
                    }
                });
                
                // Generate table
                doc.autoTable({
                    startY: Math.min(imgHeight, 100) + 50,
                    // head: [['Attribute', 'Value']],
                    body: tableData,
                    theme: 'striped',
                    styles: {
                        overflow: 'linebreak',
                        cellWidth: 'auto'
                    },
                    columnStyles: {
                        0: { fontStyle: 'bold' }, // Make the first column (attribute names) bold
                        1: { cellWidth: 'auto' }
                    }
                });
                
                // Add footer
                const pageCount = doc.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    doc.setFontSize(10);
                    doc.text('Generated on ' + new Date().toLocaleDateString(), 14, doc.internal.pageSize.height - 10);
                    doc.text('Page ' + i + ' of ' + pageCount, doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 10, { align: 'right' });
                }
                
                const now = new Date();
                const timestamp = now.getFullYear().toString() +
                                (now.getMonth() + 1).toString().padStart(2, '0') +
                                now.getDate().toString().padStart(2, '0') +
                                '_' +
                                now.getHours().toString().padStart(2, '0') +
                                now.getMinutes().toString().padStart(2, '0') +
                                now.getSeconds().toString().padStart(2, '0');

                // Save PDF with timestamp in filename
                doc.save(`${selectedTeamName.replace(/\s+/g, '_')}_area_report_${timestamp}.pdf`);
                
                // Clean up - remove the temporary map
                pdfMap.remove();
                document.body.removeChild(tempMapDiv);
                
                $('#loading').hide();
            }, 1000); // Wait 1 second after fitBounds
        });
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error generating PDF: ' + error.message);
        $('#loading').hide();
        
        // Clean up in case of error
        const tempMapDiv = document.getElementById('pdf-map-container');
        if (tempMapDiv) {
            document.body.removeChild(tempMapDiv);
        }
    }
});
    
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