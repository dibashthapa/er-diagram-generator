import DOMPurify from 'dompurify';
export const _sanitizeText = (text) => {
  if (!text) {
    return text;
  }
    text = DOMPurify.sanitize(text).toString();
  return text;
};


let accTitle = '';
let diagramTitle = '';
let accDescription = '';

export const sanitizeText = (txt) => _sanitizeText(txt);

export const clear = () => {
  accTitle = '';
  accDescription = '';
  diagramTitle = '';
};

export const setAccTitle = (txt)=> {
  accTitle = sanitizeText(txt).replace(/^\s+/g, '');
};

export const getAccTitle = () => accTitle;

export const setAccDescription = (txt)=> {
  accDescription = sanitizeText(txt).replace(/\n\s+/g, '\n');
};

export const getAccDescription = ()=> accDescription;

export const setDiagramTitle = (txt) => {
  diagramTitle = sanitizeText(txt);
};

export const getDiagramTitle = ()=> diagramTitle;
