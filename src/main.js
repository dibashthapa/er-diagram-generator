import parser from './parser.js';
import { EditorView, basicSetup } from 'codemirror';
import {
  mxGraph,
  mxClient,
  mxEvent,
  mxRubberband,
  mxFastOrganicLayout,
  mxKeyHandler,
  mxCellRenderer,
  mxEllipse
} from './factory.js';


const editor = new EditorView({
  doc: `erDiagram
    STUDENT {
        int StudentID PK
        string Name
        int Age
        string Gender
        string Address
        string Email
        int ClassID FK
    }
    
    CLASS {
        int ClassID PK
        string ClassName
        int TeacherID FK
    }
    
    TEACHER {
        int TeacherID PK
        string Name
        string Subject
        string Email
        string Phone
    }
    
    SUBJECT {
        int SubjectID PK
        string SubjectName
    }

    ENROLLMENT {
        int EnrollmentID PK
        int StudentID FK
        int ClassID FK
        int SubjectID FK
        string EnrollmentDate
    }

    ATTENDANCE {
        int AttendanceID PK
        int StudentID FK
        int ClassID FK
        date Date
        string Status
    }
    
    EXAM {
        int ExamID PK
        int ClassID FK
        int SubjectID FK
        date ExamDate
    }
    
    RESULT {
        int ResultID PK
        int StudentID FK
        int ExamID FK
        float Marks
        string Grade
    }

    STUDENT ||--|{ CLASS : "enrolled in"
    CLASS ||--|{ STUDENT : "has"
    CLASS ||--|| TEACHER : "taught by"
    CLASS ||--|{ ENROLLMENT : "has"
    STUDENT ||--|{ ENROLLMENT : "registers in"
    ENROLLMENT ||--|| SUBJECT : "includes"
    STUDENT ||--|{ ATTENDANCE : "has"
    ATTENDANCE ||--|| CLASS : "recorded for"
    EXAM ||--|| CLASS : "conducted for"
    EXAM ||--|| SUBJECT : "covers"
    RESULT ||--|| EXAM : "associated with"
    RESULT ||--|| STUDENT : "belongs to"

    `,

  extensions: [basicSetup, EditorView.lineWrapping],
  parent: document.getElementById('code-editor')
});

document.getElementById('generate-diagram').addEventListener('click', function () {
  parser.yy.clear();
  const code = editor.state.doc.toString();
  parser.parse(code);
  const diagramData = parser.yy.getData();

  document.getElementById('erContainer').innerHTML = '';
  createERDiagram(diagramData);

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

function resetGraph() {
  if (graph) {
    graph.getModel().clear();

    if (graph.eventListeners) 
      graph.eventListeners.forEach((listener) => {
        graph.removeListener(listener);
      });

    if (graph.view) 
      graph.view.clear();

    graph.destroy();
    
    graph = null

  }
}

function createERDiagram(data) {
  if (!mxClient.isBrowserSupported()) {
    alert('Browser not supported!');
    return;
  }
  let container = document.getElementById('erContainer');
  container.innerHTML = '';

  mxEvent.disableContextMenu(container);

  graph = new mxGraph(container);
  graph.setPanning(true);
  graph.panningHandler.useLeftButtonForPanning = true;
  graph.centerZoom = true;

  graph.setCellsMovable(true);
  graph.setCellsResizable(true);
  graph.setAllowDanglingEdges(false);
  graph.setCellsEditable(false);
  graph.setConnectable(false);

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

  graph.addListener(mxEvent.MOVE_CELLS, function (sender, evt) {
    const cells = evt.getProperty('cells');

    if (cells && cells.length > 0) {
      cells.forEach(function (cell) {
        if (cell.attributeData && cell.attributeData.length > 0) {
          const entityGeom = graph.getModel().getGeometry(cell);
          const entityCenterX = entityGeom.x + entityGeom.width / 2;
          const entityCenterY = entityGeom.y + entityGeom.height / 2;

          graph.getModel().beginUpdate();
          try {
            cell.attributeData.forEach(function (attrInfo) {
              const attrCell = attrInfo.cell;
              const angle = attrInfo.angle;
              const radiusX = attrInfo.radiusX;
              const radiusY = attrInfo.radiusY;
              const vertOffset = attrInfo.verticalOffset || 0;

              const attrX = entityCenterX - 60 + radiusX * Math.cos(angle);
              const attrY = entityCenterY - 20 + vertOffset + radiusY * Math.sin(angle);

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

    data.nodes.forEach((entity, index) => {
      const x = 150 + (index % 3) * 400;
      const y = 100 + Math.floor(index / 3) * 300;

      const cell = graph.insertVertex(
        parent,
        entity.id,
        entity.label,
        x,
        y,
        160,
        60,
        'shape=rectangle;rounded=0;fillColor=#FFFFFF;strokeColor=#000000;strokeWidth=2;fontColor=#000000;fontStyle=1;fontSize=14;'
      );
      entityCells.set(entity.id, cell);

      if (entity.attributes) {
        const attributeCount = entity.attributes.length;

        const layoutConfig = {
          radiusX: Math.max(150, attributeCount * 25),
          radiusY: Math.max(100, attributeCount * 20),
          startAngle: -Math.PI * 0.75,
          endAngle: Math.PI * 0.75,
          verticalOffset: 30
        };

        const validAttributes = entity.attributes.filter((attr) => attr && attr.name);

        validAttributes.forEach((attr, attrIndex) => {
          const angleRange = layoutConfig.endAngle - layoutConfig.startAngle;
          const angleStep = angleRange / (validAttributes.length - 1 || 1);
          const angle = layoutConfig.startAngle + attrIndex * angleStep;

          const attrX = x + layoutConfig.radiusX * Math.cos(angle);
          const attrY = y + layoutConfig.verticalOffset + layoutConfig.radiusY * Math.sin(angle);

          let style =
            'shape=ellipse;perimeter=ellipsePerimeter;fillColor=#FFFFFF;strokeColor=#000000;strokeWidth=1.5;';
          let displayName = attr.name;

          if (attr.keys && attr.keys.includes('PK')) {
            style =
              'shape=ellipse;perimeter=ellipsePerimeter;fillColor=#FFFFFF;strokeColor=#000000;strokeWidth=1.5;fontStyle=4;';
            displayName = attr.name;
          } else if (attr.keys && attr.keys.includes('FK')) {
            style =
              'shape=ellipse;perimeter=ellipsePerimeter;fillColor=#FFFFFF;strokeColor=#000000;strokeWidth=1.5;dashed=1;';
            displayName = attr.name;
          } 

          const attrCell = graph.insertVertex(
            parent,
            `${entity.id}-attr-${attrIndex}`,
            displayName,
            attrX,
            attrY,
            120,
            40,
            style
          );

          graph.insertEdge(parent, null, '', cell, attrCell, 'endArrow=none;strokeWidth=1.5;');

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

    data.edges.forEach((edge, index) => {
      const sourceEntity = entityCells.get(edge.start);
      const targetEntity = entityCells.get(edge.end);

      if (sourceEntity && targetEntity) {
        const sourceGeom = graph.getCellGeometry(sourceEntity);
        const targetGeom = graph.getCellGeometry(targetEntity);

        const midX =
          (sourceGeom.x + sourceGeom.width / 2 + targetGeom.x + targetGeom.width / 2) / 2;
        const midY =
          (sourceGeom.y + sourceGeom.height / 2 + targetGeom.y + targetGeom.height / 2) / 2;

        const offset = index * 10;

        const relCell = graph.insertVertex(
          parent,
          `rel-${index}`,
          edge.label || '',
          midX - 50 + offset,
          midY - 30 + offset,
          100,
          60,
          'shape=rhombus;perimeter=rhombusPerimeter;fillColor=#FFFFFF;strokeColor=#000000;strokeWidth=2;fontSize=12;'
        );

        const sourceEdgeStyle = `endArrow=none;strokeWidth=1.5;${
          edge.pattern === 'dashed' ? 'dashed=1;' : ''
        }`;
        const targetEdgeStyle = `endArrow=none;strokeWidth=1.5;${
          edge.pattern === 'dashed' ? 'dashed=1;' : ''
        }`;

        let sourceLabel = '';
        let targetLabel = '';

        switch (edge.arrowTypeStart) {
          case 'only_one':
          case 'zero_or_one':
            sourceLabel = '1';
            break;
          case 'zero_or_more':
          case 'one_or_more':
            sourceLabel = 'N';
            break;
        }

        switch (edge.arrowTypeEnd) {
          case 'only_one':
          case 'zero_or_one':
            targetLabel = '1';
            break;
          case 'zero_or_more':
          case 'one_or_more':
            targetLabel = 'N';
            break;
        }

        graph.insertEdge(
          parent,
          null,
          sourceLabel,
          sourceEntity,
          relCell,
          `${sourceEdgeStyle}labelBackgroundColor=white;align=center;verticalAlign=middle;fontSize=12;fontColor=#000000;`
        );

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

    const layout = new mxFastOrganicLayout(graph);

    layout.forceConstant = 250;
    layout.intraCellSpacing = 80;
    layout.interRankCellSpacing = 100;
    layout.disableEdgeStyle = false;
    layout.minDistanceLimit = 100;
    layout.maxDistanceLimit = 600;
    layout.initialTemp = 200;

    layout.execute(parent);

    adjustNodePositions(graph, entityCells);
  } finally {
    graph.getModel().endUpdate();
    graph.fit();
  }

  return graph;
}

function adjustNodePositions(graph, entityCells) {
  const model = graph.getModel();
  model.beginUpdate();

  try {
    entityCells.forEach((entity) => {
      const geo = model.getGeometry(entity).clone();
      if (geo.x < 50) geo.x = 50;
      if (geo.y < 50) geo.y = 50;
      model.setGeometry(entity, geo);
    });

    const allCells = Object.values(model.cells);
    const attributeCells = allCells.filter(
      (cell) => cell && cell.style && cell.style.includes('shape=ellipse')
    );

    for (let i = 0; i < attributeCells.length; i++) {
      for (let j = i + 1; j < attributeCells.length; j++) {
        const geo1 = model.getGeometry(attributeCells[i]);
        const geo2 = model.getGeometry(attributeCells[j]);

        if (rectanglesOverlap(geo1, geo2)) {
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

function rectanglesOverlap(rect1, rect2) {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}



document.getElementById('download-btn').addEventListener('click', function () {
  if (!graph) {
    alert('Generate a diagram first!');
    return;
  }
    exportAsSVG();
});

function exportAsSVG() {
  try {
    const svgElement = document.querySelector('#erContainer svg');
    if (!svgElement) {
      alert('No diagram found to export!');
      return;
    }

    const clonedSvg = svgElement.cloneNode(true);
    
    const bounds = graph.getGraphBounds();
    const padding = 20; 
    
    clonedSvg.setAttribute('width', bounds.width + (padding * 2));
    clonedSvg.setAttribute('height', bounds.height + (padding * 2));
    clonedSvg.setAttribute('viewBox', 
      `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + (padding * 2)} ${bounds.height + (padding * 2)}`);
    
    const backgroundRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    backgroundRect.setAttribute('x', bounds.x - padding);
    backgroundRect.setAttribute('y', bounds.y - padding);
    backgroundRect.setAttribute('width', bounds.width + (padding * 2));
    backgroundRect.setAttribute('height', bounds.height + (padding * 2));
    backgroundRect.setAttribute('fill', 'white');
    
    clonedSvg.insertBefore(backgroundRect, clonedSvg.firstChild);
    
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clonedSvg);
    
    const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
    
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = 'er-diagram.svg';
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    setTimeout(() => {
      URL.revokeObjectURL(svgUrl);
    }, 100);
    
  } catch (e) {
    console.error('Error during SVG export:', e);
    alert('SVG export failed. See console for details.');
  }
}
