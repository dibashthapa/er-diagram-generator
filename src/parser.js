import  { parser} from "./erDiagram.js"
import ErDB from "./erDb.js";

parser.yy = new ErDB();

export default parser;



