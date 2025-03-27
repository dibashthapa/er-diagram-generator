import { mx} from "./factory"
const mxPoint = mx.mxPoint;
const mxConstants = mx.mxConstants;
const mxGeometry = mx.mxGeometry;
const mxHierarchicalLayout = mx.mxHierarchicalLayout;
const mxFastOrganicLayout = mx.mxFastOrganicLayout;


export function ForceDirectedERLayout(graph) {
  this.graph = graph;
  
  // Basic configuration
  this.forceConstant = 50;         // Strength of forces
  this.maxIterations = 150;        // Number of simulation steps
  this.minDistanceLimit = 100;     // Minimum distance between vertices
  this.initialTemp = 200;          // Initial "temperature" for simulation
  this.useOptimized = true;        // Use optimized algorithm for large graphs
  
  // ER-specific configuration
  this.entitySpacing = 150;        // Spacing between entities
  this.attributeSpacing = 80;      // Spacing for attributes
  this.relationshipSpacing = 100;  // Spacing for relationship diamonds
  
  // Attraction/repulsion configuration
  this.entityAttractionMultiplier = 5;     // Entities attract more
  this.attributeRepulsionMultiplier = 0.5; // Attributes repel less
  this.defaultEdgeLength = 80;             // Default edge length
}

ForceDirectedERLayout.prototype.execute = function(parent) {
  let model = this.graph.getModel();
  
  model.beginUpdate();
  try {
    // Identify ER diagram components
    let erComponents = this.identifyERComponents(parent);
    
    // Create constraints based on ER diagram structure
    let constraints = this.createERConstraints(erComponents);
    
    // Create base mxFastOrganicLayout
    let layout = new mxFastOrganicLayout(this.graph);
    layout.forceConstant = this.forceConstant;
    layout.maxIterations = this.maxIterations;
    layout.minDistanceLimit = this.minDistanceLimit;
    layout.initialTemp = this.initialTemp;
    
    // Apply ER-specific force modifiers
    this.applyERForceModifiers(layout, erComponents);
    
    // Execute the layout
    layout.execute(parent);
    
    // Apply post-processing for relationships and attributes
    this.optimizeERLayout(parent, erComponents);
  } finally {
    model.endUpdate();
  }
};

/**
 * Identifies different components in an ER diagram
 */
ForceDirectedERLayout.prototype.identifyERComponents = function(parent) {
  let model = this.graph.getModel();
  let components = {
    entities: [],      // Main entity tables
    attributes: [],    // Attributes (usually ellipses)
    relationships: [], // Relationship diamonds
    connections: []    // Edge connections
  };
  
  // Process all cells
  let childCount = model.getChildCount(parent);
  
  // First identify vertices
  for (let i = 0; i < childCount; i++) {
    let cell = model.getChildAt(parent, i);
    if (!model.isEdge(cell) && model.isVisible(cell)) {
      let style = this.graph.getCellStyle(cell);
      let shape = style[mxConstants.STYLE_SHAPE] || '';
      
      // Classify by shape (common in ER diagrams)
      if (shape === 'rectangle' || shape === 'swimlane') {
        components.entities.push(cell);
      } else if (shape === 'ellipse') {
        components.attributes.push(cell);
      } else if (shape === 'rhombus') {
        components.relationships.push(cell);
      }
    }
  }
  
  // Then process edges
  for (let i = 0; i < childCount; i++) {
    let cell = model.getChildAt(parent, i);
    if (model.isEdge(cell) && model.isVisible(cell)) {
      let source = model.getTerminal(cell, true);
      let target = model.getTerminal(cell, false);
      
      if (source && target) {
        components.connections.push({
          edge: cell,
          source: source,
          target: target
        });
      }
    }
  }
  
  return components;
};

/**
 * Creates constraints specific to ER diagram structure
 */
ForceDirectedERLayout.prototype.createERConstraints = function(components) {
  let constraints = [];
  let model = this.graph.getModel();
  
  // Map to track attribute-entity relationships
  let attributeEntityMap = new Map();
  
  // Find which attributes belong to which entities
  for (let conn of components.connections) {
    let source = conn.source;
    let target = conn.target;
    
    let sourceStyle = this.graph.getCellStyle(source);
    let targetStyle = this.graph.getCellStyle(target);
    
    let sourceShape = sourceStyle[mxConstants.STYLE_SHAPE] || '';
    let targetShape = targetStyle[mxConstants.STYLE_SHAPE] || '';
    
    // If connecting entity to attribute
    if (sourceShape === 'rectangle' && targetShape === 'ellipse') {
      if (!attributeEntityMap.has(target.id)) {
        attributeEntityMap.set(target.id, source);
      }
    }
    // Handle reverse connection
    else if (sourceShape === 'ellipse' && targetShape === 'rectangle') {
      if (!attributeEntityMap.has(source.id)) {
        attributeEntityMap.set(source.id, target);
      }
    }
  }
  
  return constraints;
};

/**
 * Applies ER-specific force modifiers to the layout
 */
ForceDirectedERLayout.prototype.applyERForceModifiers = function(layout, components) {
  // Create custom force calculation function
  let originalForceFunction = layout.calcForce;
  
  layout.calcForce = function(i, j, u, v, x) {
    // Get base force
    let force = originalForceFunction.apply(this, arguments);
    
    // Modify force based on vertex types
    let v1 = this.vertices[i].cell;
    let v2 = this.vertices[j].cell;
    
    let isEntity1 = components.entities.includes(v1);
    let isEntity2 = components.entities.includes(v2);
    let isAttribute1 = components.attributes.includes(v1);
    let isAttribute2 = components.attributes.includes(v2);
    
    // Entities should be spaced further apart
    if (isEntity1 && isEntity2) {
      return force * 1.5; // Increase repulsion between entities
    }
    
    // Attributes should be closer to their entities
    if ((isEntity1 && isAttribute2) || (isEntity2 && isAttribute1)) {
      return force * 0.6; // Reduce force between entities and attributes
    }
    
    // Attributes should be closer together
    if (isAttribute1 && isAttribute2) {
      return force * 0.8; // Reduce repulsion between attributes
    }
    
    return force;
  };
};

/**
 * Post-processes the layout for ER-specific optimizations
 */
ForceDirectedERLayout.prototype.optimizeERLayout = function(parent, components) {
  let model = this.graph.getModel();
  
  // Create a map of entities and their attributes
  let entityAttributeMap = new Map();
  
  // Identify entity-attribute relationships
  for (let conn of components.connections) {
    let source = conn.source;
    let target = conn.target;
    
    let sourceStyle = this.graph.getCellStyle(source);
    let targetStyle = this.graph.getCellStyle(target);
    
    let sourceShape = sourceStyle[mxConstants.STYLE_SHAPE] || '';
    let targetShape = targetStyle[mxConstants.STYLE_SHAPE] || '';
    
    // If entity -> attribute connection
    if (sourceShape === 'rectangle' && targetShape === 'ellipse') {
      if (!entityAttributeMap.has(source.id)) {
        entityAttributeMap.set(source.id, {
          entity: source,
          attributes: []
        });
      }
      
      entityAttributeMap.get(source.id).attributes.push({
        attribute: target,
        edge: conn.edge
      });
    }
    // If attribute -> entity connection (reverse)
    else if (sourceShape === 'ellipse' && targetShape === 'rectangle') {
      if (!entityAttributeMap.has(target.id)) {
        entityAttributeMap.set(target.id, {
          entity: target,
          attributes: []
        });
      }
      
      entityAttributeMap.get(target.id).attributes.push({
        attribute: source,
        edge: conn.edge
      });
    }
  }
  
  // Optimize attribute positioning
  entityAttributeMap.forEach((info) => {
    if (info.attributes.length > 0) {
      this.optimizeAttributesForEntity(info);
    }
  });
  
  // Optimize relationship positioning
  this.optimizeRelationshipPositioning(components);
};

/**
 * Optimizes attribute positioning around an entity
 */
ForceDirectedERLayout.prototype.optimizeAttributesForEntity = function(entityInfo) {
  let model = this.graph.getModel();
  let entity = entityInfo.entity;
  let entityGeo = model.getGeometry(entity);
  
  // Entity center
  let centerX = entityGeo.x + entityGeo.width / 2;
  let centerY = entityGeo.y + entityGeo.height / 2;
  
  // Calculate optimal radius based on number of attributes
  let attrCount = entityInfo.attributes.length;
  let radius = Math.max(entityGeo.width, entityGeo.height) + this.attributeSpacing;
  
  // Arrange attributes in a circle
  for (let i = 0; i < attrCount; i++) {
    let attrInfo = entityInfo.attributes[i];
    let attribute = attrInfo.attribute;
    let edge = attrInfo.edge;
    
    let attrGeo = model.getGeometry(attribute).clone();
    
    // Calculate position on circle
    let angle = (i * 2 * Math.PI) / attrCount;
    let x = centerX + radius * Math.cos(angle) - attrGeo.width / 2;
    let y = centerY + radius * Math.sin(angle) - attrGeo.height / 2;
    
    // Update attribute position
    attrGeo.x = x;
    attrGeo.y = y;
    model.setGeometry(attribute, attrGeo);
    
    // Update edge geometry
    if (edge) {
      let edgeGeo = model.getGeometry(edge);
      if (!edgeGeo) {
        edgeGeo = new mxGeometry();
        edgeGeo.relative = true;
      } else {
        edgeGeo = edgeGeo.clone();
      }
      
      // Clear any existing points
      edgeGeo.points = [];
      model.setGeometry(edge, edgeGeo);
    }
  }
};

/**
 * Optimizes positioning of relationship diamonds
 */
ForceDirectedERLayout.prototype.optimizeRelationshipPositioning = function(components) {
  let model = this.graph.getModel();
  
  // Create a map to track relationships between entities
  let relationshipMap = new Map();
  
  // Identify relationships between entities
  for (let relationship of components.relationships) {
    let relatedEntities = [];
    
    // Find connected entities
    for (let conn of components.connections) {
      if (conn.source === relationship && components.entities.includes(conn.target)) {
        relatedEntities.push({ entity: conn.target, edge: conn.edge });
      } else if (conn.target === relationship && components.entities.includes(conn.source)) {
        relatedEntities.push({ entity: conn.source, edge: conn.edge });
      }
    }
    
    if (relatedEntities.length >= 2) {
      relationshipMap.set(relationship.id, {
        relationship: relationship,
        entities: relatedEntities
      });
    }
  }
  
  // Optimize each relationship position
  relationshipMap.forEach((info) => {
    this.centerRelationship(info);
  });
};

/**
 * Centers a relationship diamond between its connected entities
 */
ForceDirectedERLayout.prototype.centerRelationship = function(relationshipInfo) {
  let model = this.graph.getModel();
  let relationship = relationshipInfo.relationship;
  let entities = relationshipInfo.entities;
  
  // Calculate center point between entities
  let totalX = 0, totalY = 0;
  for (let entityInfo of entities) {
    let entity = entityInfo.entity;
    let entityGeo = model.getGeometry(entity);
    
    totalX += entityGeo.x + entityGeo.width / 2;
    totalY += entityGeo.y + entityGeo.height / 2;
  }
  
  let centerX = totalX / entities.length;
  let centerY = totalY / entities.length;
  
  // Update relationship position
  let relGeo = model.getGeometry(relationship).clone();
  relGeo.x = centerX - relGeo.width / 2;
  relGeo.y = centerY - relGeo.height / 2;
  model.setGeometry(relationship, relGeo);
  
  // Update connecting edges
  for (let entityInfo of entities) {
    let edge = entityInfo.edge;
    if (edge) {
      let edgeGeo = model.getGeometry(edge);
      if (!edgeGeo) {
        edgeGeo = new mxGeometry();
        edgeGeo.relative = true;
      } else {
        edgeGeo = edgeGeo.clone();
      }
      
      // Clear any existing points for direct connection
      edgeGeo.points = [];
      model.setGeometry(edge, edgeGeo);
    }
  }
};
