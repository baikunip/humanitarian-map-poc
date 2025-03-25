const teams = [
    {
      teamId: "T001",
      teamName: "Global Operations",
      region: "Global",
      manager: "Jane Smith",
      parentTeam: null
    },
    {
      teamId: "T002",
      teamName: "Africa Programs",
      region: "Africa",
      manager: "John Doe",
      parentTeam: "T001"
    },
    {
      teamId: "T003",
      teamName: "Asia Programs",
      region: "Asia",
      manager: "Sarah Wong",
      parentTeam: "T001"
    },
    {
      teamId: "T004",
      teamName: "Kenya Projects",
      region: "Kenya",
      manager: "Alice Johnson",
      parentTeam: "T002"
    },
    {
      teamId: "T006",
      teamName: "Nairobi Initiative",
      region: "Nairobi",
      manager: "Bob Williams",
      parentTeam: "T004"
    },
    {
      teamId: "T007",
      teamName: "India Programs",
      region: "India",
      manager: "Raj Patel",
      parentTeam: "T003"
    },
    {
      teamId: "T008",
      teamName: "Delhi Projects",
      region: "Delhi",
      manager: "Priya Sharma",
      parentTeam: "T007"
    },
    {
      teamId: "T009",
      teamName: "Mumbai Projects",
      region: "Mumbai",
      manager: "Arjun Singh",
      parentTeam: "T007"
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
    let geojsonData = null;
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
                'fill-opacity': 0.5
            }
        });
        
        // Add line layer
        map.addLayer({
            id: 'geojson-line',
            type: 'line',
            source: 'geojson-source',
            paint: {
                'line-color': '#000',
                'line-width': 1
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
            // Update feature states
            updateSelectionStyle();
        }
    }
    
    
    // Change cursor on hover
    map.on('mouseenter', 'geojson-fill', function() {
        map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', 'geojson-fill', function() {
        map.getCanvas().style.cursor = '';
    });
    
    // Update selection styling
    function updateSelectionStyle() {
        if (map.getSource('geojson-source')) {
            map.setPaintProperty('geojson-fill', 'fill-color', [
                'case',
                ['in', ['get', 'id'], ['literal', selectedFeatures.map(f => f.properties.id)]],
                '#ff9e00',
                '#0080ff'
            ]);
        }
    }
    $('#select-button').click(function(){
        map.off('click', 'geojson-fill', geoFillClicked);
        selecting = !selecting;
        if (selecting) {
            // Entering selection mode
            map.on('click', 'geojson-fill', geoFillClicked);
            $(this).text('Cancel Selection').removeClass('btn-primary')
            .addClass('btn-danger');
            $('#merge-button').prop('disabled', false);
        } else {
            // Canceling selection mode
            selectedFeatures=[]
            updateSelectionStyle();
            $(this).text('Select Places').removeClass('btn-danger')
            .addClass('btn-primary');
            $('#merge-button').prop('disabled', true);
        }
    })
    // Merge selected features
    $('#merge-button').click(function() {
        if (selectedFeatures.length < 2) {
            alert('Please select at least two features to merge.');
            return;
        }
        
        $('#loading').show();
        
        try {
            // Create a feature collection from selected features
            const featureCollection = {
                type: 'FeatureCollection',
                features: selectedFeatures
            };
            
            // Perform union operation with turf.js
            let union = selectedFeatures[0];
            for (let i = 1; i < selectedFeatures.length; i++) {
                union = turf.union(union, selectedFeatures[i]);
            }
            
            // Create merged feature with combined properties
            mergedFeature = {
                type: 'Feature',
                geometry: union.geometry,
                properties: {
                    id: 'merged',
                    name: 'Merged Feature',
                    area_km2: turf.area(union) / 1000000, // Convert m² to km²
                    perimeter_km: turf.length(turf.polygonToLine(union)) / 1000, // Convert m to km
                    kec: selectedFeatures.map(f => f.properties.WADMKC).join(', '),
                    kab: selectedFeatures.map(f => f.properties.WADMKK).join(', ')
                }
            };
            
            // Update the map with the merged feature
            if (map.getSource('merged-source')) {
                map.getSource('merged-source').setData({
                    type: 'FeatureCollection',
                    features: [mergedFeature]
                });
            } else {
                // Add merged feature source and layers
                map.addSource('merged-source', {
                    type: 'geojson',
                    data: {
                        type: 'FeatureCollection',
                        features: [mergedFeature]
                    }
                });
                
                // Add fill layer for merged feature
                map.addLayer({
                    id: 'merged-fill',
                    type: 'fill',
                    source: 'merged-source',
                    paint: {
                        'fill-color': '#32CD32',
                        'fill-opacity': 0.6
                    }
                });
                
                // Add outline for merged feature
                map.addLayer({
                    id: 'merged-line',
                    type: 'line',
                    source: 'merged-source',
                    paint: {
                        'line-color': '#006400',
                        'line-width': 2
                    }
                });
            }
            
            // Clear selection
            selectedFeatures = [];
            updateSelectionStyle();
            selecting = false;
            $('#select-button').text('Select Places').removeClass('btn-danger').addClass('btn-primary');
            
            // Enable PDF button
            $('#pdf-button').prop('disabled', false);
            alert('Features successfully merged!');
        } catch (error) {
            console.error('Error merging features:', error);
            alert('Error merging features. Please try again with different selections.');
        }
        
        $('#loading').hide();
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
    let selectedTeamName = "Selected Area";
    
    // Find the team name from the teams array
    if (selectedTeamId) {
        const selectedTeam = teams.find(team => team.teamId === selectedTeamId);
        if (selectedTeam) {
            selectedTeamName = selectedTeam.teamName;
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
                doc.setFontSize(10);
                doc.text('Merged Feature Visualization', 105, Math.min(imgHeight, 100) + 35, { align: 'center' });
                
                // Add feature attributes table
                doc.setFontSize(14);
                doc.text('Merged Feature Attributes', 14, Math.min(imgHeight, 100) + 45);
                
                // Format properties for table with deduplication for kab and kec
                const tableData = [];
                
                // Process the properties
                Object.entries(mergedFeature.properties).forEach(([key, value]) => {
                    // Format numbers to 2 decimal places
                    if (typeof value === 'number') {
                        tableData.push([key, value.toFixed(2)]);
                    } 
                    // Deduplicate comma-separated values for kab and kec
                    else if (key === 'kab' || key === 'kec') {
                        if (typeof value === 'string') {
                            // Split by comma, trim whitespace, filter out empty values, and deduplicate
                            const uniqueValues = [...new Set(
                                value.split(',')
                                     .map(v => v.trim())
                                     .filter(v => v !== '')
                            )];
                            // Join back with commas
                            tableData.push([key, uniqueValues.join(', ')]);
                        } else {
                            tableData.push([key, value]);
                        }
                    } 
                    // Handle other properties normally
                    else {
                        tableData.push([key, value]);
                    }
                });
                
                // Add team information to the table
                tableData.push(['team', selectedTeamName]);
                
                // Generate table
                doc.autoTable({
                    startY: Math.min(imgHeight, 100) + 50,
                    head: [['Attribute', 'Value']],
                    body: tableData,
                    theme: 'striped',
                    headStyles: { fillColor: [0, 128, 255] }
                });
                
                // Add footer
                const pageCount = doc.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    doc.setFontSize(10);
                    doc.text('Generated on ' + new Date().toLocaleDateString(), 14, doc.internal.pageSize.height - 10);
                    doc.text('Page ' + i + ' of ' + pageCount, doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 10, { align: 'right' });
                }
                
                // Save PDF
                doc.save(`${selectedTeamName.replace(/\s+/g, '_')}_area_report.pdf`);
                
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
