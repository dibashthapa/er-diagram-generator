import parser from './parser.js';
import {
  mxGraph,
  mxUtils,
  mxXmlCanvas2D,
  mxImageExport,
  mxXmlRequest,
  mxClient,
  mxEvent,
  mxRubberband,
  mxFastOrganicLayout,
  mxKeyHandler,
  mxCellRenderer,
  mxEllipse
} from './factory.js';



// Initialize CodeMirror
let editor;
document.addEventListener('DOMContentLoaded', function() {

  editor = CodeMirror(document.getElementById('code-editor'), {
    mode: 'javascript', // You could create a custom mode for your syntax
    theme: 'nord',
    lineNumbers: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    indentUnit: 2,
    tabSize: 2,
    indentWithTabs: false,
    lineWrapping: true,
    viewportMargin: Infinity,
    extraKeys: {
      "Ctrl-Space": "autocomplete",
      "Tab": function(cm) {
        const spaces = Array(cm.getOption("indentUnit") + 1).join(" ");
        cm.replaceSelection(spaces);
      }
    }
  });
  
  // Make the editor resizable
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'editor-resize-handle';
  document.querySelector('.editor-container').appendChild(resizeHandle);
  
  let startY, startHeight;
  
  resizeHandle.addEventListener('mousedown', function(e) {
    startY = e.clientY;
    startHeight = parseInt(document.defaultView.getComputedStyle(editor.getWrapperElement()).height, 10);
    document.addEventListener('mousemove', resizeEditor);
    document.addEventListener('mouseup', stopResize);
    e.preventDefault();
  });
  
  function resizeEditor(e) {
    const newHeight = startHeight + e.clientY - startY;
    editor.setSize(null, newHeight);
  }
  
  function stopResize() {
    document.removeEventListener('mousemove', resizeEditor);
    document.removeEventListener('mouseup', stopResize);
  }
});

// Update your generate button event listener to use CodeMirror's value
document.getElementById('generate-diagram').addEventListener('click', function () {
  const code = editor.getValue();
  parser.parse(code);
  const diagramData = parser.yy.getData();

  document.getElementById('erContainer').innerHTML = '';
  createERDiagram(diagramData);
  
  // Hide empty state
  const emptyState = document.getElementById('empty-state');
  if (emptyState) {
    emptyState.style.display = 'none';
  }
});
let graph;

const zoomOutBtn = document.getElementById('zoom-out');
const zoomInBtn = document.getElementById('zoom-in');
const resetZoomBtn = document.getElementById('zoom-reset');

zoomInBtn.addEventListener('click', function () {
  console.log('zoomIn');
  graph.zoomTo(graph.view.scale + 0.1, true);
});

zoomOutBtn.addEventListener('click', function () {
  graph.zoomTo(graph.view.scale - 0.1, true);
});

resetZoomBtn.addEventListener('click', function () {
  graph.fit();
});

function createERDiagram(data) {
  if (!mxClient.isBrowserSupported()) {
    alert('Browser not supported!');
    return;
  }

  let container = document.getElementById('erContainer');

  mxEvent.disableContextMenu(container);

  graph = new mxGraph(container);
  graph.setPanning(true);
  graph.panningHandler.useLeftButtonForPanning = true;
  graph.centerZoom = true;

  // Enable cell movement for better positioning
  graph.setCellsMovable(true);
  graph.setCellsResizable(true);
  graph.setAllowDanglingEdges(false);
  graph.setCellsEditable(false);
  graph.setConnectable(false);

  // Register for mouse wheel zooming
  mxEvent.addMouseWheelListener(function (evt, up) {
    if (evt.ctrlKey) {
      if (up) {
        graph.zoomIn();
      } else {
        graph.zoomOut();
      }
      mxEvent.consume(evt);
    }
  });

  // Add handler for moving attributes with entities
  graph.addListener(mxEvent.MOVE_CELLS, function (sender, evt) {
    const cells = evt.getProperty('cells');

    // Check if we have moved cells
    if (cells && cells.length > 0) {
      cells.forEach(function (cell) {
        // Only handle entity cells that have attributes
        if (cell.attributeData && cell.attributeData.length > 0) {
          // Get the entity's current geometry
          const entityGeom = graph.getModel().getGeometry(cell);
          const entityCenterX = entityGeom.x + entityGeom.width / 2;
          const entityCenterY = entityGeom.y + entityGeom.height / 2;

          // Start a new update transaction
          graph.getModel().beginUpdate();
          try {
            // Update each attribute position
            cell.attributeData.forEach(function (attrInfo) {
              const attrCell = attrInfo.cell;
              const angle = attrInfo.angle;
              const radiusX = attrInfo.radiusX;
              const radiusY = attrInfo.radiusY;
              const vertOffset = attrInfo.verticalOffset || 0;

              // Calculate new position based on entity center
              const attrX = entityCenterX - 60 + radiusX * Math.cos(angle);
              const attrY = entityCenterY - 20 + vertOffset + radiusY * Math.sin(angle);

              // Update attribute position
              const attrGeom = graph.getModel().getGeometry(attrCell).clone();
              attrGeom.x = attrX;
              attrGeom.y = attrY;
              graph.getModel().setGeometry(attrCell, attrGeom);
            });
          } finally {
            graph.getModel().endUpdate();
          }
        }
      });
    }
  });

  let parent = graph.getDefaultParent();

  new mxRubberband(graph);
  new mxKeyHandler(graph);

  if (mxCellRenderer.registerShape) {
    mxCellRenderer.registerShape('ellipse', mxEllipse);
  }

  graph.getModel().beginUpdate();

  try {
    const entityCells = new Map();

    // Create entities (rectangles in Chen notation)
    data.nodes.forEach((entity, index) => {
      // Calculate position with better spacing
      const x = 150 + (index % 3) * 400;
      const y = 100 + Math.floor(index / 3) * 300;

      // Chen notation: Entities are rectangles with bold borders
      const cell = graph.insertVertex(
        parent,
        entity.id,
        entity.label,
        x,
        y,
        160, // Slightly wider for better text display
        60, // Taller for better appearance
        'shape=rectangle;rounded=0;fillColor=#FFFFFF;strokeColor=#000000;strokeWidth=2;fontColor=#000000;fontStyle=1;fontSize=14;'
      );
      entityCells.set(entity.id, cell);

      // Create attributes
      if (entity.attributes) {
        const attributeCount = entity.attributes.length;

        // Enhanced attribute layout configuration
        const layoutConfig = {
          radiusX: Math.max(150, attributeCount * 25), // More space for attributes
          radiusY: Math.max(100, attributeCount * 20), // More vertical space
          startAngle: -Math.PI * 0.75, // Start above and to the left
          endAngle: Math.PI * 0.75, // End below and to the left
          verticalOffset: 30 // Vertical positioning offset
        };

        // Filter out invalid attributes
        const validAttributes = entity.attributes.filter((attr) => attr && attr.name);

        // Create attributes in a circular pattern
        validAttributes.forEach((attr, attrIndex) => {
          // Calculate angle step based on valid attributes count
          const angleRange = layoutConfig.endAngle - layoutConfig.startAngle;
          const angleStep = angleRange / (validAttributes.length - 1 || 1);
          const angle = layoutConfig.startAngle + attrIndex * angleStep;

          // Calculate position with larger radius for better spacing
          const attrX = x + layoutConfig.radiusX * Math.cos(angle);
          const attrY = y + layoutConfig.verticalOffset + layoutConfig.radiusY * Math.sin(angle);

          // Chen notation: Attributes are ovals
          // Different styling for key attributes (underlined in Chen notation)
          let style =
            'shape=ellipse;perimeter=ellipsePerimeter;fillColor=#FFFFFF;strokeColor=#000000;strokeWidth=1.5;';
          let displayName = attr.name;

          // Primary key styling (underlined in Chen notation)
          if (attr.keys && attr.keys.includes('PK')) {
            style =
              'shape=ellipse;perimeter=ellipsePerimeter;fillColor=#FFFFFF;strokeColor=#000000;strokeWidth=1.5;fontStyle=4;'; // 4 = underlined
            displayName = attr.name; // In Chen, just underline the PK
          }
          // Foreign key styling
          else if (attr.keys && attr.keys.includes('FK')) {
            style =
              'shape=ellipse;perimeter=ellipsePerimeter;fillColor=#FFFFFF;strokeColor=#000000;strokeWidth=1.5;dashed=1;';
            displayName = attr.name; // In Chen, dashed line for derived/FK attributes
          }
          // Multivalued attribute (double oval in Chen)
          else if (attr.multivalued) {
            style =
              'shape=doubleEllipse;perimeter=ellipsePerimeter;fillColor=#FFFFFF;strokeColor=#000000;strokeWidth=1.5;';
          }
          // Derived attribute (dashed oval in Chen)
          else if (attr.derived) {
            style =
              'shape=ellipse;perimeter=ellipsePerimeter;fillColor=#FFFFFF;strokeColor=#000000;strokeWidth=1.5;dashed=1;';
          }

          // Create attribute cell
          const attrCell = graph.insertVertex(
            parent,
            `${entity.id}-attr-${attrIndex}`,
            displayName,
            attrX,
            attrY,
            120, // Width
            40, // Height
            style
          );

          // Chen notation: Simple straight lines connect attributes to entities
          graph.insertEdge(parent, null, '', cell, attrCell, 'endArrow=none;strokeWidth=1.5;');

          // Store attribute data for movement handling
          if (!cell.attributeData) {
            cell.attributeData = [];
          }
          cell.attributeData.push({
            cell: attrCell,
            angle: angle,
            radiusX: layoutConfig.radiusX,
            radiusY: layoutConfig.radiusY,
            verticalOffset: layoutConfig.verticalOffset
          });
        });
      }
    });

    // Create relationships (diamonds in Chen notation)
    data.edges.forEach((edge, index) => {
      const sourceEntity = entityCells.get(edge.start);
      const targetEntity = entityCells.get(edge.end);

      if (sourceEntity && targetEntity) {
        const sourceGeom = graph.getCellGeometry(sourceEntity);
        const targetGeom = graph.getCellGeometry(targetEntity);

        // Calculate midpoint between entities with offset to prevent overlap
        const midX =
          (sourceGeom.x + sourceGeom.width / 2 + targetGeom.x + targetGeom.width / 2) / 2;
        const midY =
          (sourceGeom.y + sourceGeom.height / 2 + targetGeom.y + targetGeom.height / 2) / 2;

        // Add slight offset for multiple relationships between the same entities
        const offset = index * 10;

        // Chen notation: Relationships are diamonds
        const relCell = graph.insertVertex(
          parent,
          `rel-${index}`,
          edge.label || '',
          midX - 50 + offset,
          midY - 30 + offset,
          100, // Larger diamond for better text display
          60, // Larger diamond for better text display
          'shape=rhombus;perimeter=rhombusPerimeter;fillColor=#FFFFFF;strokeColor=#000000;strokeWidth=2;fontSize=12;'
        );

        // Chen notation uses simpler edge styles
        const sourceEdgeStyle = `endArrow=none;strokeWidth=1.5;${
          edge.pattern === 'dashed' ? 'dashed=1;' : ''
        }`;
        const targetEdgeStyle = `endArrow=none;strokeWidth=1.5;${
          edge.pattern === 'dashed' ? 'dashed=1;' : ''
        }`;

        // Prepare cardinality labels
        let sourceLabel = '';
        let targetLabel = '';

        // Chen notation uses (1) and (N) for cardinalities
        switch (edge.arrowTypeStart) {
          case 'only_one':
          case 'zero_or_one':
            sourceLabel = '(1)';
            break;
          case 'zero_or_more':
          case 'one_or_more':
            sourceLabel = '(N)';
            break;
        }

        switch (edge.arrowTypeEnd) {
          case 'only_one':
          case 'zero_or_one':
            targetLabel = '(1)';
            break;
          case 'zero_or_more':
          case 'one_or_more':
            targetLabel = '(N)';
            break;
        }

        // Edge from source entity to relationship
        graph.insertEdge(
          parent,
          null,
          sourceLabel,
          sourceEntity,
          relCell,
          `${sourceEdgeStyle}labelBackgroundColor=white;align=center;verticalAlign=middle;fontSize=12;fontColor=#000000;`
        );

        // Edge from relationship to target entity
        graph.insertEdge(
          parent,
          null,
          targetLabel,
          relCell,
          targetEntity,
          `${targetEdgeStyle}labelBackgroundColor=white;align=center;verticalAlign=middle;fontSize=12;fontColor=#000000;`
        );
      }
    });

    // Use Fast Organic Layout for better spacing and distribution
    const layout = new mxFastOrganicLayout(graph);

    // Configure layout for optimal spacing
    layout.forceConstant = 250; // Stronger repulsive forces
    layout.intraCellSpacing = 80; // More space between cells
    layout.interRankCellSpacing = 100; // More space between ranks
    layout.disableEdgeStyle = false; // Keep edge styles
    layout.minDistanceLimit = 100; // Minimum distance between nodes
    layout.maxDistanceLimit = 600; // Maximum distance between nodes
    layout.initialTemp = 200; // Higher initial temperature for better distribution

    // Execute layout
    layout.execute(parent);

    // Optional: make minor adjustments to improve readability
    adjustNodePositions(graph, entityCells);
  } finally {
    graph.getModel().endUpdate();
  }

  return graph;
}

// Helper function to make final position adjustments
function adjustNodePositions(graph, entityCells) {
  const model = graph.getModel();
  model.beginUpdate();

  try {
    // Ensure entities are not too close to the edges
    entityCells.forEach((entity) => {
      const geo = model.getGeometry(entity).clone();
      if (geo.x < 50) geo.x = 50;
      if (geo.y < 50) geo.y = 50;
      model.setGeometry(entity, geo);
    });

    // Get all attribute cells
    const allCells = Object.values(model.cells);
    const attributeCells = allCells.filter(
      (cell) => cell && cell.style && cell.style.includes('shape=ellipse')
    );

    // Resolve attribute overlaps
    for (let i = 0; i < attributeCells.length; i++) {
      for (let j = i + 1; j < attributeCells.length; j++) {
        const geo1 = model.getGeometry(attributeCells[i]);
        const geo2 = model.getGeometry(attributeCells[j]);

        if (rectanglesOverlap(geo1, geo2)) {
          // Move apart slightly
          const newGeo = geo2.clone();
          newGeo.x += 20;
          newGeo.y += 20;
          model.setGeometry(attributeCells[j], newGeo);
        }
      }
    }
  } finally {
    model.endUpdate();
  }
}

// Helper function to check if rectangles overlap
function rectanglesOverlap(rect1, rect2) {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

function exportFile(format) {
  console.log('Exporting diagram as ' + format);
  var bg = '#ffffff';
  var scale = 4;
  var b = 1;

  var imgExport = new mxImageExport();
  var bounds = graph.getGraphBounds();
  var vs = graph.view.scale;

  // New image export
  var xmlDoc = mxUtils.createXmlDocument();
  var root = xmlDoc.createElement('output');
  xmlDoc.appendChild(root);

  // Renders graph. Offset will be multiplied with state's scale when painting state.
  var xmlCanvas = new mxXmlCanvas2D(root);
  xmlCanvas.translate(
    Math.floor((b / scale - bounds.x) / vs),
    Math.floor((b / scale - bounds.y) / vs)
  );
  xmlCanvas.scale(scale / vs);

  imgExport.drawState(graph.getView().getState(graph.model.root), xmlCanvas);

  // Puts request data together
  var w = Math.ceil((bounds.width * scale) / vs + 2 * b);
  var h = Math.ceil((bounds.height * scale) / vs + 2 * b);

  var xml = mxUtils.getXml(root);

  if (bg != null) {
    bg = '&bg=' + bg;
  }

  new mxXmlRequest(
    '/Export',
    'filename=export.' +
      format +
      '&format=' +
      format +
      bg +
      '&w=' +
      w +
      '&h=' +
      h +
      '&xml=' +
      encodeURIComponent(xml)
  ).simulate(document, '_blank');
}

document.getElementById('generate-diagram').addEventListener('click', function () {
  const code = editor.state.doc.toString();
  parser.parse(code);
  const diagramData = parser.yy.getData();
  console.log(JSON.stringify(diagramData, null, 2));

  document.getElementById('graphContainer').innerHTML = '';

  createERDiagram(diagramData);
});

document.getElementById('download-btn').addEventListener('click', function () {
  if (!graph) {
    alert('Generate a diagram first!');
    return;
  }

  try {
    // Get the SVG element from the graph
    const svg = document.querySelector('#graphContainer svg');
    if (!svg) {
      alert('No diagram found to export!');
      return;
    }

    // Clone the SVG to avoid modifying the original
    const clonedSvg = svg.cloneNode(true);

    // Calculate bounds and size
    const bounds = graph.getGraphBounds();
    const scale = 1.5; // Higher resolution for better quality

    // Set explicit dimensions on the SVG
    clonedSvg.setAttribute('width', bounds.width * scale);
    clonedSvg.setAttribute('height', bounds.height * scale);

    // Add a white background
    const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    background.setAttribute('width', '100%');
    background.setAttribute('height', '100%');
    background.setAttribute('fill', 'white');
    clonedSvg.insertBefore(background, clonedSvg.firstChild);

    // Serialize to SVG string
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clonedSvg);

    // Create a blob and URL
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    // Create an image to render the SVG
    const img = new Image();

    img.onload = function () {
      // Create canvas at the same dimensions
      const canvas = document.createElement('canvas');
      canvas.width = bounds.width * scale;
      canvas.height = bounds.height * scale;
      const ctx = canvas.getContext('2d');

      // Fill with white and draw the image
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Convert to PNG data URL
      try {
        const pngUrl = canvas.toDataURL('image/png');

        // Create and trigger download link
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = 'er-diagram.png';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        // Clean up resources
        URL.revokeObjectURL(svgUrl);
      } catch (e) {
        console.error('Failed to create PNG:', e);
        alert('Error creating PNG. Try exporting as SVG instead.');

        // Fallback to SVG download if PNG fails
        const svgDownload = document.createElement('a');
        svgDownload.href = svgUrl;
        svgDownload.download = 'er-diagram.svg';
        document.body.appendChild(svgDownload);
        svgDownload.click();
        document.body.removeChild(svgDownload);
      }
    };

    img.onerror = function (e) {
      console.error('Failed to load SVG as image:', e);
      alert('Error generating image. Downloading SVG instead.');

      // Fallback to direct SVG download
      const svgDownload = document.createElement('a');
      svgDownload.href = svgUrl;
      svgDownload.download = 'er-diagram.svg';
      document.body.appendChild(svgDownload);
      svgDownload.click();
      document.body.removeChild(svgDownload);
    };

    // Start the process
    img.src = svgUrl;
  } catch (e) {
    console.error('Error during export:', e);
    alert('Export failed. See console for details.');
  }
}); // Improved download functionality
