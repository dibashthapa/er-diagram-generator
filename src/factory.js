const factory = require('mxgraph');

export const mx = factory.call(window, {
  mxBasePath: 'mxgraph',
  mxLoadResources: false,
  mxForceIncludes: false,
  mxResourceExtension: '.txt',
  mxLoadStylesheets: false
});
export const mxGraph = mx.mxGraph;
export const mxUtils = mx.mxUtils;
export const mxXmlCanvas2D = mx.mxXmlCanvas2D;
export const mxImageExport = mx.mxImageExport;
export const mxXmlRequest = mx.mxXmlRequest;
export const mxClient = mx.mxClient;
export const mxEvent = mx.mxEvent;
export const mxRubberband = mx.mxRubberband;
export const mxFastOrganicLayout = mx.mxFastOrganicLayout;
export const mxKeyHandler = mx.mxKeyHandler;
export const mxCellRenderer = mx.mxCellRenderer;
export const mxEllipse = mx.mxEllipse;