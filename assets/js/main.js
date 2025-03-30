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
    const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
            polygon: true,
            trash: true
        }
    });
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
    map.addControl(draw, 'top-right');
    function selectFeaturesWithinPolygon(drawnPolygon) {
        // Clear previous selection
        selectedFeatures = [];
        
        // Get all features from the geojson source
        const features = map.querySourceFeatures('geojson-source');
        
        // For each feature, check if it intersects with the drawn polygon
        features.forEach(feature => {
            try {
                // Check for intersection using Turf.js
                const intersection = turf.booleanIntersects(feature, drawnPolygon);
                
                if (intersection) {
                    // Add to selected features
                    selectedFeatures.push(feature);
                }
            } catch (error) {
                console.error('Error checking intersection:', error, feature);
            }
        });
        
        // Update the selection styling
        updateSelectionStyle();
        
        // Optional: Delete the drawn polygon after selection
        // draw.deleteAll();
        
        // Show count of selected features
        alert(`Selected ${selectedFeatures.length} features.`);
    }
    map.on('draw.create', function(e) {
        // Get the drawn polygon
        const drawnPolygon = e.features[0];
        
        // Process the drawn polygon and find intersecting features (for properties only)
        processDrawnPolygon(drawnPolygon);
    });
    map.on('click', function(e) {
        if (selecting && draw.getMode() === 'simple_select') {
            // If we're in selection mode but not actively drawing,
            // restart the drawing mode
            draw.changeMode('draw_polygon');
        }
    });
    map.on('draw.delete', function() {
        if (selecting) {
            // Clear selection when drawn polygon is deleted
            selectedFeatures = [];
            updateSelectionStyle();
        }
    });

    function processDrawnPolygon(drawnPolygon) {
        $('#loading').show();
        
        try {
            // First, find intersecting features to highlight them
            const features = map.querySourceFeatures('geojson-source');
            selectedFeatures = features.filter(feature => {
                try {
                    return turf.booleanIntersects(feature, drawnPolygon);
                } catch (error) {
                    console.error('Error checking intersection:', error);
                    return false;
                }
            });
            
            // Update the selection styling to highlight intersecting features
            updateSelectionStyle();
            
            // Get multiple points from the polygon to query Nominatim
            const points = getSamplePointsFromPolygon(drawnPolygon);
            
            // Query Nominatim for each point
            queryDistrictNames(points, drawnPolygon);
        } catch (error) {
            console.error('Error processing polygon:', error);
            alert('Error processing polygon: ' + error.message);
            $('#loading').hide();
        }
    }
    function getSamplePointsFromPolygon(polygon) {
        try {
            const points = [];
            
            // Get center point
            const center = turf.centroid(polygon);
            points.push(center);
            
            // Get points along the boundary
            const boundary = turf.polygonToLine(polygon);
            const length = turf.length(boundary);
            const pointCount = Math.min(Math.max(3, Math.ceil(length * 5)), 10); // 3-10 points based on perimeter
            
            for (let i = 0; i < pointCount; i++) {
                const along = turf.along(boundary, (length / pointCount) * i);
                points.push(along);
            }
            
            return points;
        } catch (error) {
            console.error('Error getting sample points:', error);
            // Fallback to just using the center
            return [turf.centroid(polygon)];
        }
    }
    function queryDistrictNames(points, drawnPolygon) {
        const kelurahanNames = new Set();
        const kecamatanNames = new Set();
        const kabupatenNames = new Set();
        let completedQueries = 0;
        
        // If no points to query
        if (points.length === 0) {
            finalizeFeatureWithDistricts(drawnPolygon, [], [], []);
            return;
        }
        
        // Queue for rate limiting (Nominatim allows ~1 request/second)
        const queue = [];
        let isProcessingQueue = false;
        
        // Add all point queries to the queue
        points.forEach((point, index) => {
            const [lng, lat] = turf.getCoord(point);
            queue.push({ lng, lat, index });
        });
        
        // Process the query queue with rate limiting
        function processQueue() {
            if (queue.length === 0) {
                isProcessingQueue = false;
                return;
            }
            
            isProcessingQueue = true;
            const next = queue.shift();
            queryPoint(next.lng, next.lat, next.index);
            
            // Wait 1.1 seconds before processing the next query (respecting Nominatim rate limits)
            setTimeout(processQueue, 1100);
        }
        
        // Start processing the queue
        if (!isProcessingQueue && queue.length > 0) {
            processQueue();
        }
        
        // Function to query a single point
        function queryPoint(lng, lat, pointIndex) {
            // Use Nominatim reverse geocoding
            $.ajax({
                url: 'https://nominatim.openstreetmap.org/reverse',
                data: {
                    format: 'json',
                    lat: lat,
                    lon: lng,
                    zoom: 18, // Detailed level for getting kelurahan
                    addressdetails: 1,
                    "accept-language": 'id' // Indonesian language for better results
                },
                success: function(data) {
                    try {
                        // Extract Indonesian administrative levels
                        if (data.address) {
                            // Kelurahan (village/urban community)
                            const kelurahan = 
                                data.address.village || 
                                data.address.suburb || 
                                data.address.neighbourhood ||
                                data.address.quarter;
                            
                            // Kecamatan (sub-district)
                            const kecamatan = 
                                data.address.subdistrict || 
                                data.address.district || 
                                data.address.city_district;
                            
                            // Kabupaten/Kota (regency/city)
                            const kabupaten = 
                                data.address.city || 
                                data.address.town || 
                                data.address.regency || 
                                data.address.county;
                            
                            // Add to our sets if found
                            if (kelurahan) kelurahanNames.add(kelurahan);
                            if (kecamatan) kecamatanNames.add(kecamatan);
                            if (kabupaten) kabupatenNames.add(kabupaten);
                            
                            // Update query point properties to show found values
                            if (map.getSource('query-points-source')) {
                                const features = map.getSource('query-points-source')._data.features;
                                if (features[pointIndex]) {
                                    features[pointIndex].properties.kelurahan = kelurahan || 'N/A';
                                    features[pointIndex].properties.kecamatan = kecamatan || 'N/A';
                                    features[pointIndex].properties.kabupaten = kabupaten || 'N/A';
                                    
                                    map.getSource('query-points-source').setData({
                                        type: 'FeatureCollection',
                                        features: features
                                    });
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error processing Nominatim response:', error);
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Nominatim API error:', error);
                },
                complete: function() {
                    completedQueries++;
                    
                    // When all queries are done
                    if (completedQueries === points.length) {
                        finalizeFeatureWithDistricts(
                            drawnPolygon,
                            Array.from(kelurahanNames),
                            Array.from(kecamatanNames),
                            Array.from(kabupatenNames)
                        );
                    }
                }
            });
        }
    }
    function finalizeFeatureWithDistricts(drawnPolygon, kelurahanNames, kecamatanNames, kabupatenNames) {
        // Create the feature using the drawn polygon geometry
        mergedFeature = {
            type: 'Feature',
            geometry: drawnPolygon.geometry,
            properties: {
                id: 'drawn',
                name: 'Drawn Feature',
                area_km2: turf.area(drawnPolygon) / 1000000, // Convert m² to km²
                perimeter_km: turf.length(turf.polygonToLine(drawnPolygon)) / 1000, // Convert m to km
                kelurahan: kelurahanNames.join(', ') || 'Unknown',
                kec: kecamatanNames.join(', ') || 'Unknown',
                kab: kabupatenNames.join(', ') || 'Unknown'
            }
        };
        
        // Update the map with the drawn feature
        displayDrawnFeature();
        
        // Enable PDF button
        $('#pdf-button').prop('disabled', false);
        
        $('#loading').hide();
        
        // Show results
        alert(`Found ${kelurahanNames.length} kelurahan, ${kecamatanNames.length} kecamatan, and ${kabupatenNames.length} kabupaten in the drawn area.`);
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
                    'fill-opacity': 0.6
                }
            });
            
            // Add outline for drawn feature
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
    }
    
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
        // map.addSource('geojson-source', {
        //     type: 'geojson',
        //     data: kec_boundaries
        // });
        
        // Add fill layer
        // map.addLayer({
        //     id: 'geojson-fill',
        //     type: 'fill',
        //     source: 'geojson-source',
        //     paint: {
        //         'fill-color': [
        //             'case',
        //             ['in', ['get', 'id'], ['literal', selectedFeatures.map(f => f.properties.id)]],
        //             '#ff9e00',
        //             '#0080ff'
        //         ],
        //         'fill-opacity': 0.01
        //     }
        // });
        
        // Add line layer
        // map.addLayer({
        //     id: 'geojson-line',
        //     type: 'line',
        //     source: 'geojson-source',
        //     paint: {
        //         'line-color': '#000',
        //         'line-width': 1
        //     }
        // });
        
        // Fit map to GeoJSON bounds
        // if (kec_boundaries.features.length > 0) {
        //     const bounds = turf.bbox(kec_boundaries);
        //     map.fitBounds([
        //         [bounds[0], bounds[1]],
        //         [bounds[2], bounds[3]]
        //     ], { padding: 50 });
        // }
        
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
            updateSelectionStyle();
            
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
