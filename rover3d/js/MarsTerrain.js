import * as THREE from './three.module.js';

import './decode-tiff.min.js';
const { decode } = window.decodeTiff;


let terrain = {}
//let terrainWireframe, terrain2;

window.terrain = terrain;




terrain.load = function(params){
  if(params.urlHeightMap==undefined) {
    console.log("makeTerrain error: expected urlHeightMap in parameters array");
    return;
  }
  const hscale = (params.hscale==undefined) ? 1 : params.hscale;
  const vscale = (params.vscale==undefined) ? 1 : params.vscale;
  const offset = (params.offset==undefined) ? new THREE.Vector3(0,0,0) : params.offset;
  const rotation = (params.rotation==undefined) ? new THREE.Vector3(0,0,0) : params.rotation;
  const textureImage = params.textureImage;
  const color = (params.color==undefined) ? 0xaf9681 : params.color;

  terrain.matl = new THREE.MeshPhongMaterial({color: color, shininess: 2 });


  console.log("loading terrain");
  const terrainMesh = new THREE.Mesh();

  terrainMesh.hscale = hscale; // not used by 3js; just note for general use elsewhere
  terrainMesh.vscale = vscale; // not used by 3js; just note for general use elsewhere 
  
  console.log("loading height map");
  readTiff(params.urlHeightMap, function(heightMap){

    terrainMesh.geometry = new THREE.PlaneBufferGeometry(heightMap.width*hscale, heightMap.height*hscale, heightMap.width-1, heightMap.height-1);
    
    //set height of vertices:
    const vertices = terrainMesh.geometry.attributes.position;
    for(var i=0; i<vertices.count; i++ ) {
      vertices.setZ(i, heightMap.data[i]*vscale);
    }

    terrainMesh.position.copy(offset);
    terrainMesh.rotation.setFromVector3(rotation, 'XYZ');

    terrainMesh.geometry.computeFaceNormals();          
    terrainMesh.geometry.computeVertexNormals();
    terrainMesh.castShadow = true;
    terrainMesh.receiveShadow = true;
    //terrainMesh.matrixAutoUpdate = false;;

    console.log("done loading terrain height map");
    

    if(textureImage==undefined){
      if(params.onload!==undefined) params.onload(terrainMesh);
    } else {
      console.log("loading texture:  " + textureImage);
      terrain.matl.map = new THREE.TextureLoader().load(textureImage, function(){
        console.log("done loading terrain texture");
        if(params.onload!==undefined) params.onload(terrainMesh);
      });
    }


    /*
    // Make terrain wireframe:
    terrainWireframe = new THREE.Mesh();
    terrainWireframe.name = "Terrain wireframe";
    terrainWireframe.visible = options["tools"].showWireframe;
    terrainWireframe.material = new THREE.MeshBasicMaterial({
      color: 0x111111,
      wireframe: true,
    });
    terrainWireframe.geometry = terrainMesh.geometry;
    terrainWireframe.rotation.copy(terrainMesh.rotation);
    terrainWireframe.position.copy(terrainMesh.position);
    terrainWireframe.position.y += +0.02;
    terrainMesh.attach(terrainWireframe);
    */
  });
}



terrain.createChunks = function(mastermesh, nChunksWidth, nChunksLength, onload){  
  const chunks = new THREE.Group();
  chunks.name = "chunked terrain";

  const masterWidthVertices   = mastermesh.geometry.parameters.widthSegments + 1;
  const masterHeightVertices  = mastermesh.geometry.parameters.heightSegments + 1;
  const chunkWidthVertices    = Math.floor(masterWidthVertices/nChunksWidth) +1;  //+1 for overlap
  const chunkHeightVertices   = Math.floor(masterHeightVertices/nChunksLength) +1;
  const hscale                = mastermesh.geometry.parameters.width / masterWidthVertices;

  const masterVertices        = mastermesh.geometry.attributes.position;
  const masterNormals         = mastermesh.geometry.attributes.normal;
  const masterUVs             = mastermesh.geometry.attributes.uv;

  const chunkMatl = terrain.matl;
  

  // Loop through each chunk:
  for(var chunkIdxLength=0; chunkIdxLength<nChunksLength; chunkIdxLength++){
    for(var chunkIdxWidth=0; chunkIdxWidth<nChunksWidth; chunkIdxWidth++){
      // if this is the last chunk in this row or col then reduce the corresponding dimension by 1
      const thisChunkWidthVerts  = (chunkIdxWidth < nChunksWidth-1) ? chunkWidthVertices  : chunkWidthVertices -1;
      const thisChunkHeightVerts = (chunkIdxLength < nChunksLength-1) ? chunkHeightVertices : chunkHeightVertices -1;
      const chunkGeom = new THREE.PlaneBufferGeometry(
        thisChunkWidthVerts * hscale, 
        thisChunkHeightVerts * hscale, 
        thisChunkWidthVerts -1, 
        thisChunkHeightVerts -1
      );
      const chunkVertices = chunkGeom.attributes.position;
      const chunkNormals  = chunkGeom.attributes.normal;
      const chunkUVs      = chunkGeom.attributes.uv;
                  
      // Loop through each vertex in this chunk:
      for(  var chunkVertexIdxLength=0; chunkVertexIdxLength<thisChunkHeightVerts; chunkVertexIdxLength++ ) {
        for(var chunkVertexIdxWidth=0; chunkVertexIdxWidth<thisChunkWidthVerts;  chunkVertexIdxWidth++ ) {
          const chunkVertexIdx = chunkVertexIdxLength*thisChunkWidthVerts + chunkVertexIdxWidth;
          const masterVertexIdxWidth = chunkIdxWidth*(chunkWidthVertices-1) + chunkVertexIdxWidth;
          const masterVertexIdxLength = chunkIdxLength*(chunkHeightVertices-1) + chunkVertexIdxLength;
          const masterVertexIdx = masterVertexIdxLength*masterWidthVertices + masterVertexIdxWidth;
          
          chunkVertices.setX(chunkVertexIdx, masterVertices.getX(masterVertexIdx));
          chunkVertices.setY(chunkVertexIdx, masterVertices.getY(masterVertexIdx));
          chunkVertices.setZ(chunkVertexIdx, masterVertices.getZ(masterVertexIdx));
          
          chunkNormals.setX( chunkVertexIdx, masterNormals.getX(masterVertexIdx));
          chunkNormals.setY( chunkVertexIdx, masterNormals.getY(masterVertexIdx));
          chunkNormals.setZ( chunkVertexIdx, masterNormals.getZ(masterVertexIdx));
          
          chunkUVs.setX( chunkVertexIdx, masterUVs.getX(masterVertexIdx));
          chunkUVs.setY( chunkVertexIdx, masterUVs.getY(masterVertexIdx));
          chunkUVs.setZ( chunkVertexIdx, masterUVs.getZ(masterVertexIdx));
          
        }
      }            
      const chunk = new THREE.Mesh(chunkGeom, chunkMatl);
      chunk.geometry.computeBoundingBox();
      chunk.castShadow = true;
      chunk.receiveShadow = true;
      chunks.add(chunk);
    }
  }
  
  chunks.rotation.copy(mastermesh.rotation);
  chunks.position.copy(mastermesh.position);
 
  
  if(onload!==undefined) onload(chunks);
  return chunks;
}

function readTiff(url, onload) {
  var xhr = new XMLHttpRequest();
  console.log("getting tiff file: " + url);
  xhr.open("GET", url);
  //xhr.responseType = "blob";
  xhr.responseType = 'arraybuffer';

  xhr.onload = function (e) {
    if (this.status == 200) {
      console.log("Reading tiff file");
      //var blob = new Blob([xhr.response], {type: "image/tiff"});
      const { width, height, data, ifdEntries } = decode(xhr.response, {singlePage: true, normalizeStripData: false} );
      const metadata = JSON.stringify({ width, height, ifdEntries }, null, 2);
      //console.log(metadata);
      if(onload!==undefined) onload({width: width, height: height, data: data});
      return {width: width, height: height, data: data};
    } else {
      console.log("Error, return status: " + this.status);
      console.log(e);
    }
  };
  xhr.onerror = function(e) {
    alert("Error Status: " + e.target.status);
  };
  xhr.send();
}



export { terrain };
