// ...
// Based on 
// Created by Bjorn Sandvik - thematicmapping.org

//import * as THREE from './three.module.js';
//import { OrbitControls } from './OrbitControls.js';

import * as THREE from "https://threejs.org/build/three.module.js";
import { OrbitControls } from "https://threejs.org/examples/jsm/controls/OrbitControls.js";

let camera, controls, scene, renderer, ephem, options, light, globe, labels, pins, PointsOfInterest, stars, GlobeGroup;

let selectedObject = null;


const mapFiles = [
  'color_map_mgs_2k.jpg',
  'color_map_8k.jpg',
  'color_map_aaas_labels.jpg',
  'color_map_msss_labeled.jpg',
  'color_map_nasa_landing_sites.jpg',
  'color_map_viking_reduced.jpg',
  'color_map_mgs_hungarian.jpg',
  'color_map_mpf_planning.jpg',
  'color_map_peach_voltmer.jpg',
  'color_map_voltmer.jpg',
  'color_map_sujka.jpg',
  'albedo_1958.jpg',
  'albedo_antoniadi_1900.jpg',
  'albedo_map_mgs_tes.jpg',
  'albedo_map_mutch_1971.jpg',
  'topo_map_mola_machacek.jpg',
  'geology_mariner9.jpg',
  'hydrated_minerals_mex.jpg',
  'fantasy.jpg',
  'terraformed.jpg',	
];


const webglEl = document.getElementById('webgl');
/*if (!Detector.webgl) {
  Detector.addGetWebGLMessage(webglEl);
  return;
}*/


window.addEventListener( 'resize', onWindowResize, {passive: true}, false );

var width  = document.documentElement.clientWidth,
  height = document.documentElement.clientHeight;
  

// Globe params
var globe_radius   = 0.5,
  segments = 32,
  rotation = 0,
  globeLoaded = false,
  labelsLoaded = false,
  radsPerDeg = Math.PI/180;

options = {
  mirror:  false,
  mapFile: 'color_map_mgs_2k.jpg',
  labels_sel: 'coarse',
  labels_opacity: 0.5,
  bumpScale: 0.01,
  cameraDist: 7,
  sunPlaneDist: 60,
  rotation: 0,
  r: 1,
  g: 1,
  b: 1,
  initToCurrent: false,
  showPins: true,
  shininess: 15,
  northUp: true,
  showCoordFrame: false,
};

ephem = {
  loaded: false,
  data: null,
  ObsSubLat: null,
  ObsSubLon: null,
  SunSubLat: null,
  SunSubLon: null,
}

startLoadingManager();

init();


function init(){
  console.log("initializing renderer");
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(width, height);
  webglEl.appendChild(renderer.domElement);

  console.log(renderer);
  renderer.domElement.addEventListener("webglcontextlost", function(event){  
    event.preventDefault();
    //cancelRequestAnimationFrame(requestId);
    alert("webgl crashed?");
    console.log("webgl crashed?");
    console.log(event);
  }, false);
  
  console.log("checking capabilities");
  const linearFloatTexturesSupported = (renderer.extensions.get('OES_texture_float_linear') != null);
  console.log("OES_texture_float_linear supported? " + linearFloatTexturesSupported);

  scene = new THREE.Scene();
  
  camera = new THREE.PerspectiveCamera(15, width/height, 0.01, 250);
  camera.position.x = options.cameraDist;
  camera.up.set(0,0,1);
  console.log(camera);
  scene.add(camera);

  light = new THREE.PointLight(0xffffff, 1, 1000, 1);
  light.rotateX(Math.PI/2);  // reorient to z-up
  light.position.set(options.sunPlaneDist,0,0);
  camera.add(light);

  scene.add(new THREE.AmbientLight(0x222222));  // faint background light
  
  GlobeGroup = new THREE.Group();
  scene.add(GlobeGroup);
  // createCoordAxes(GlobeGroup, globe_radius*1.5);

  globe = new THREE.Mesh();
  createGlobe(globe_radius, segments);
  // createCoordAxes(globe, globe_radius*1.1);

  const GlobeCoordAxes = createCoordAxes(scene, globe_radius*1.2);
  GlobeCoordAxes.visible = options.showCoordFrame;
  scene.remove(GlobeCoordAxes);
  GlobeGroup.add(GlobeCoordAxes);

  var stars = createStars(200);

  labels = new THREE.Mesh();
  createLabels(globe_radius*1.01, segments);

  controls = new OrbitControls(camera, renderer.domElement );
  //controls.enablePan = false;

  // need these for gui controls:
  var ephemQueryNowFcn = { add:function(){ showNow() }};
  var ephemQueryUtcFcn = { add:function(){ showSpecificTime()  }};


  var gui = new dat.GUI();
  gui.add(light.position, 'x', -90, 90).listen().name("sun az");
  gui.add(light.position, 'y', -15, 15).listen().name("sun el");
  gui.add(options, 'rotation', 0, 6.2832).listen().name("planet rotation").onChange(function(val){ GlobeGroup.rotation.z = val; });
  gui.add(options, 'northUp').listen().name("north up").onChange(function(){ setPoleOrientation() });
  gui.add(options, 'mirror').listen().onChange(function(boolMirror){ setMirroring(boolMirror) });
  gui.add(options, 'showPins').listen().name("Show pins").onChange(function(){ togglePins() });
  gui.add(options, 'showCoordFrame').listen().name("Show coordinate frame").onChange(function(val){ GlobeCoordAxes.visible = val });
  gui.add(options, 'mapFile',mapFiles).listen().name("Base map").onChange(function(){changeMap()});
  gui.add(options, 'labels_sel',["none","coarse","fine"]).listen().name("Labels").onChange(function(){changeLabels()});
  gui.add(options, 'labels_opacity',0,1).listen().name("labels opacity").onChange(function(){labels.material.opacity = options.labels_opacity});
  gui.add(options, 'bumpScale',0,0.1).listen().name("texture scale").onChange(function(val){globe.material.bumpScale=val;});
  gui.add(options, 'r',0.6,1).listen().name("red").onChange(function(val){globe.material.color.r=val;});
  gui.add(options, 'g',0.6,1).listen().name("green").onChange(function(val){globe.material.color.g=val;});
  gui.add(options, 'b',0.6,1).listen().name("blue").onChange(function(val){globe.material.color.b=val;});
  gui.add(ephemQueryNowFcn,'add').name("Show now");
  gui.add(ephemQueryUtcFcn,'add').name("Show specific time");


  PointsOfInterest = new THREE.Group();
  pins = new THREE.Group();
  if(linearFloatTexturesSupported) createPins(globe_radius*1.02, globe_radius*0.01, 0x66ddff);

  render();

  console.log(scene);
  
  loadEphemData(showNow);

  window.globals = {webglEl, camera, controls, scene, renderer, ephem, options, light, globe, labels, pins, GlobeGroup};
	window.addEventListener( "mousemove", onDocumentMouseMove, {passive: true}, false );
}


function startLoadingManager(){
  const status = document.getElementById('status_container');
  THREE.DefaultLoadingManager.onStart = function ( url, itemsLoaded, itemsTotal ) {
    console.log( 'Started loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.' );
    status.style.color = "orange";
    status.innerText = "Loading";
  };
  THREE.DefaultLoadingManager.onProgress = function ( url, itemsLoaded, itemsTotal ) {
    console.log( 'Loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.' );
  };
  THREE.DefaultLoadingManager.onLoad = function ( ) {
    console.log( 'Loading Complete!');
    status.style.color = "green";
    status.innerText = "Ready";
  };
}


function setPoleOrientation(){
  var sceneRotatedBefore = (scene.rotation.y != 0);
  console.log("setting view orientation to north-up: " + options.northUp);
  scene.rotation.y = options.northUp ? 0 : Math.PI;
  controls.rotateSpeed = options.northUp ? 1 : -1;
  console.log("controls rotate speed:  " + controls.rotateSpeed);
  var sceneRotatedAfter = (scene.rotation.y != 0);
  var toggled = (sceneRotatedBefore != sceneRotatedAfter);
  console.log("scene rotated");
  if(toggled) {
    light.position.y *= -1;
    light.position.x *= -1;
  }
}




function togglePins(){
  document.getElementById('poi_container').display = options.showPins ? 'block' : 'none';
  pins.visible = options.showPins;
  PointsOfInterest.visible = options.showPins;
}



function showPointOfInterestInfo(index){
  var poiCaption = document.getElementById('poi_info');
  //console.log(poiCaption);
  console.log(data[index]);
  const info = data[index].split("#");
  //console.log(info);
  poiCaption.innerHTML = "";
  document.getElementById('poi_image').src = "";
  //console.log(feature_types[data_type[index]]);
  //console.log(data_type[index]);
  poiCaption.innerHTML += "Feature type:  " + feature_types[data_type[index]] + " <br />";
  for(var i=0; i<info.length; i++){
    poiCaption.innerHTML += info[i];
    poiCaption.innerHTML += " <br />"
  }
  if(data_urls[index]) poiCaption.innerHTML += '<a href="' + data_urls[index] + '" target="_blank">Reference</a> <br />';
  if(data_imgs[index]) {
    var imgurl = 'https://www.google.com/mars/' + data_imgs[index];  
    document.getElementById('poi_image').src = imgurl;
  }
}




function onDocumentMouseMove( event ) {
  if(!options.showPins){
    return;
  }
  //event.preventDefault();
  const intersects = getIntersects( event.layerX, event.layerY, PointsOfInterest );

  if ( intersects.length > 0 ) {
    const res = intersects.filter( function ( res ) {
      return res && res.object;
    } )[ 0 ];
    var cameraDistToOrigin = Math.sqrt( camera.position.x*camera.position.x + camera.position.y*camera.position.y + camera.position.z*camera.position.z);
    if ( res && res.object && res.distance < cameraDistToOrigin) {
      var prevSelectedObjectIndex = selectedObject ? selectedObject.name : -1;
      selectedObject = res.object;
      //console.log(res);
      var selectedObjectIndex = selectedObject.name;
      if(prevSelectedObjectIndex != selectedObjectIndex){
        //console.log(selectedObjectIndex, prevSelectedObjectIndex);
        showPointOfInterestInfo(selectedObjectIndex);
      }
    }
  }
}


const raycaster = new THREE.Raycaster();
const mouseVector = new THREE.Vector3();

function getIntersects( x, y, group) {
  x = ( x / window.innerWidth ) * 2 - 1;
  y = - ( y / window.innerHeight ) * 2 + 1;
  mouseVector.set( x, y, 0.5 );
  raycaster.setFromCamera( mouseVector, camera );
  return raycaster.intersectObject( group, true );
}



function makeTextSprite(message, opts) {
  var parameters = opts || {};
  var fontface = parameters.fontface || 'Helvetica';
  var fontsize = parameters.fontsize || 120;
  var fontcolor = parameters.fontcolor || 'rgba(0, 0, 0, 1)';
  var fillcolor = parameters.fillcolor || "rgba(128, 128, 128, 0.8)";
  var bordercolor = parameters.bordercolor || "rgba(0,0,0,0.8)";
  var borderwidth = parameters.borderwidth || 1;
  var canvas = document.createElement('canvas');
  var context = canvas.getContext('2d');
  var position = parameters.position || new THREE.Vector3(1,1,1);
  var scale = parameters.scale || 1;
  
  context.font = fontsize + "px " + fontface;
  var metrics = context.measureText(message);
  var textWidth = metrics.width;
  var textHeight = metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent;
  
  var borderLineWidth = borderwidth/scale/4;
  var radius = Math.sqrt(textWidth*textWidth + textHeight*textHeight)/2 * 1.1;
  canvas.width = radius*2 + borderLineWidth*2;
  canvas.height = canvas.width;
  var centerX = canvas.width / 2;
  var centerY = canvas.height / 2;

  // Make filled circle:
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
  context.fillStyle = fillcolor;
  context.fill();
  context.stroke();
  
  // make border:
  context.beginPath();
  context.arc(centerX, centerY, radius + borderLineWidth/2 -4, 0, 2 * Math.PI, false);
  context.lineWidth = borderLineWidth;
  context.strokeStyle = bordercolor;
  context.stroke();

  // Make text
  context.textAlign = "center";
  context.font = fontsize + "px " + fontface;
  context.fillStyle = fontcolor; // font color
  context.fillText(message, centerX , centerY + textHeight/2);
  
  // canvas contents will be used for a texture
  var texture = new THREE.Texture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  var spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  var sprite = new THREE.Sprite( spriteMaterial );
  sprite.scale.set( scale, scale, scale );
  sprite.position.copy(position);
  //sprite.center.set( 0,1 );
  return sprite;
}



function showNow(){
  var dateQuery = new Date();
  console.log("Time now:  " + dateQuery);
  interpolateEphemeris(dateQuery);
  renderEphemeris();
}

function showSpecificTime(){
  console.log("ephemQueryUtcFcn");
  var strResponse = prompt("UTC time  (YYYY-MM-DD HH:MM):");
  console.log("Time input dialog response:  " + strResponse);

  // handle empty response (cancel)
  if(strResponse == null){
    console.log("empty response");
    return;
  }

  // if received a response, then make sure user input meets required format:
  if(! (new RegExp('20[0-5]{2}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}').test(strResponse) )){
    alert("Error, invalid format");
    return;
  }
  
  // convert to date object:
  var dateQuery = new Date(strResponse.replace(' ','T') + ":00Z") || 0;
  if(dateQuery>0){
    console.log("query time:  " + dateQuery.toISOString());
    interpolateEphemeris(dateQuery);
    renderEphemeris();
  } else {
    console.log("error, invalid date");
  }
}

function interpolateEphemeris(dateQuery){
  var strQueryDate = dateQuery.toISOString().substring(0,10);
  var dayFrac = (dateQuery.getTime()/1000/60/60/24) % 1;
  console.log(strQueryDate + ' ' + dayFrac*24 + ' hours');

  // round down to 1/4 day:
  var hourRoundedDown = Math.floor(dayFrac*4)*6;
  var strDateInterpBelow = strQueryDate + " " + (hourRoundedDown<10?"0":"") + hourRoundedDown + ":00";
  console.log("strDateInterpBelow: " + strDateInterpBelow);
  var interpRatio = (dayFrac*24 % 6) / 6;
  console.log("interp ratio: " + interpRatio);
  
  // get interp upper bound:
  var strDateInterpAbove = new Date(new Date(strDateInterpBelow.replace(" ","T") + ":00Z").valueOf() + 6*60*60*1000).toISOString().substring(0,16).replace(/T/g, " ");
  console.log("interp bounds:  " + strDateInterpBelow + ", " + strDateInterpAbove);

  // get entries before and after query time:
  // fixme:  handle lookup errors
  var ephemBelow = ephem.data[strDateInterpBelow][0];
  console.log(ephemBelow);
  var ephemAbove = ephem.data[strDateInterpAbove][0];
  console.log(ephemAbove);
  
  // interpolate sub-observer longitude:
  ephem.ObsSubLon = (ephemBelow.ObsSubLon + interpRatio*(ephemAbove.ObsSubLon - ephemBelow.ObsSubLon + (ephemAbove.ObsSubLon<ephemBelow.ObsSubLon?360:0) ) ) % 360;
  
  // interpolate sub-observer latitude:
  ephem.ObsSubLat = (ephemBelow.ObsSubLat + interpRatio*(ephemAbove.ObsSubLat - ephemBelow.ObsSubLat));
  
  // interpolate sub-sun point
  ephem.SunSubLon = (ephemBelow.SunSubLon + interpRatio*(ephemAbove.SunSubLon - ephemBelow.SunSubLon + (ephemAbove.SunSubLon<ephemBelow.SunSubLon?360:0) )) % 360;
  ephem.SunSubLat = (ephemBelow.SunSubLat + interpRatio*(ephemAbove.SunSubLat - ephemBelow.SunSubLat));

  console.log("calculated ephemeris:");
  console.log(ephem);
}

function loadEphemData(callback){
  console.log("callback: " + callback);
  console.log("typeof callback: " + (typeof callback));
  console.log("loading ephemeris file");
  $.getJSON('js/ephem.json')
  .done(function(data) { 
    console.log("done"); 
    ephem.data = data;
    console.log("testing ephem lookup:  ");
    console.log(data["2020-01-01 06:00"][0]); // test	
    ephem.loaded = true;
    if(typeof callback == 'function' ) callback();
  })
  .fail(function(jqXHR, textStatus, errorThrown) {
    console.log("error " + textStatus);
    console.log("incoming Text " + jqXHR.responseText);
  })
}


function renderEphemeris(){
  console.log("Rendering ephemeris");
  console.log(ephem);
  
  // set globe z-axis rotation to sub-observer longitude:
  GlobeGroup.rotation.z  = ephem.ObsSubLon*radsPerDeg;
  
  // tilt camera to sub-observer latitude:
  camera.position.set(
    options.cameraDist*Math.cos(ephem.ObsSubLat*radsPerDeg),
    0,
    options.cameraDist*Math.sin(ephem.ObsSubLat*radsPerDeg),
  );
    
  // move light source (in camera frame) according to interpolated sun direction
  var deltaLonEarthSun = ephem.ObsSubLon - ephem.SunSubLon;
  var deltaLatEarthSun = ephem.ObsSubLat - ephem.SunSubLat;
  console.log("setting sun position to lat " + deltaLatEarthSun + ", lon " + deltaLonEarthSun);
  // this is in camera frame where 
  /*light.position.set(
    options.sunPlaneDist,
    options.sunPlaneDist * Math.sin(deltaLonEarthSun*radsPerDeg),
    options.sunPlaneDist * Math.sin(deltaLatEarthSun*radsPerDeg),
  );*/
  // this is in camera frame, where +Y is up, +X is right, +Z is forward 
  light.position.set(
    options.sunPlaneDist * Math.sin(deltaLonEarthSun*radsPerDeg) * 1.5 * (options.northUp ? 1 : -1) ,
    options.sunPlaneDist * Math.sin(deltaLatEarthSun*radsPerDeg) *-1.5 * (options.northUp ? 1 : -1),
    options.sunPlaneDist,
  );
  console.log(light.position);
}


function changeMap(){
  var mapfile = 'images/' + options.mapFile;
  console.log("changing base map to: " + mapfile);
  globe.material.map = new THREE.TextureLoader().load(mapfile);
  globe.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if(options.mirror){
    reverseTexture();
  }
}

function changeLabels(){
  console.log("changing labels: " + options.labels_sel);
  labels.visible = false;
  if(options.labels_sel=="none"){
    //labels.material.map.();
  } else {
    labels.material.transparent = false;
    var labelfile = 'images/' + options.labels_sel + '_labels.png';
    console.log("loading file:  " + labelfile); 
    
    const loader = new THREE.TextureLoader();
    loader.load(labelfile, (texture) => {
      console.log("loaded labels; setting anisotropy");
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      console.log("applying texture to material");
      const material = new THREE.MeshLambertMaterial({
        map:        texture,
        transparent: true,
        opacity:     options.labels_opacity,
        side:        THREE.DoubleSide,
      });
      console.log("applied texture to material");
      console.log("applying texture to labels object");
      labels.material = material;
      console.log("requesting anim frame");
      requestAnimationFrame(render);
      console.log("making visible");
      labels.visible = true;
      console.log("requesting anim frame");
      requestAnimationFrame(render);
      console.log("done");      
    });      
  }
  
  if(options.mirror){
    reverseTexture();
  }
}

function setMirroring(boolMirror){
  if(boolMirror){
    labels.material.map = new THREE.TextureLoader().load('images/labels_inv.png');
    controls.rotateSpeed = -1;
    controls.dynamicDampingFactor = -0.2;
    webglEl.style.transform = "scaleX(-1)";
  } else {
    controls.rotateSpeed = 1;
    controls.dynamicDampingFactor = 0.2;
    labels.material.map = new THREE.TextureLoader().load('images/' + options.labels_sel + '_labels.png');
    webglEl.style.transform = "scaleX(1)";
  }
}

function render() {
  controls.update();
  requestAnimationFrame(render);
  renderer.render(scene, camera);
}

function createGlobe(radius, segments) {
  console.log("making globe");
  const geometry = new THREE.SphereGeometry(radius, segments, segments);
  const material = new THREE.MeshPhongMaterial({
    shininess:  options.shininess,
    bumpScale:  options.bumpScale,
    side:       THREE.DoubleSide,
    minFilter:  THREE.LinearFilter,
  });
  globe = new THREE.Mesh(geometry, material);
  globe.rotateX(Math.PI/2);  // reorient to z-up
  globe.rotation.z = options.rotation; 
  GlobeGroup.add(globe);
  globeLoaded = true;

  if(options.initToCurrent && labelsLoaded) {console.log("calling showNow from createGlobe"); showNow(); }

  // Load elevation model:  
  const bumpMapFile = 'images/mars_bump_map_4k_adj.jpg';
  console.log("loading bump map " + bumpMapFile);
  globe.material.bumpMap = new THREE.TextureLoader().load(bumpMapFile);

  // Load base map
  changeMap();
  //console.log(globe);
}


function createLabels(radius, segments) {
  console.log("making labels");
  const geometry = new THREE.SphereGeometry(radius, segments, segments);
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity:     options.labels_opacity,
    side:        THREE.DoubleSide,
    minFilter:  THREE.LinearFilter,
  });
  labels = new THREE.Mesh(geometry, material);  
  labels.rotateX(Math.PI/2);  // reorient to z-up
  labels.rotation.z = options.rotation; 
  GlobeGroup.add(labels);
  labelsLoaded = true;
  if(options.initToCurrent && globeLoaded) {console.log("calling showNow from createGlobe"); showNow()};

  // require either coarse or fine labels selection
  if(options.labels_sel!="fine" && options.labels_sel!="coarse"){ return; }
  
  // load labels map file as texture:
  var texturefilename = 'images/' + options.labels_sel + '_labels.png';
  console.log("loading labels file: " + texturefilename);
  labels.material.map = new THREE.TextureLoader().load(texturefilename);
}

function createStars(radius) {
  console.log("making stars");		
  const loader = new THREE.TextureLoader();
  loader.load('images/starfield.jpg', (texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4,4);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide
    });
    const geometry = new THREE.SphereGeometry(radius, 64, 64);
    stars = new THREE.Mesh(geometry, material);
    stars.rotateX(Math.PI/2);  // reorient to z-up
    console.log(stars);
    stars.rotation.z = rotation; 
    scene.add(stars);
  });
}

function createPins(vector_length, pinhead_radius, pin_color) {
  togglePins();

  for(var i=0; i<data_lats.length; i++){
  //for(var i=0; i<200; i++){
    console.log("Pin " + i + " data: " + data[i]);
    const pin_position = new THREE.Vector3(
      vector_length * Math.cos(data_lons[i]*radsPerDeg) * Math.cos(data_lats[i]*radsPerDeg),
      vector_length * Math.sin(data_lons[i]*radsPerDeg) * Math.cos(data_lats[i]*radsPerDeg),
      vector_length * Math.sin(data_lats[i]*radsPerDeg),
    );

    // make needle:
    const needle_geometry = new THREE.BufferGeometry().setFromPoints( [new THREE.Vector3(0,0,0), pin_position] );
    const needle_material = new THREE.LineBasicMaterial({ 	color: pin_color, opacity: 0.2 });
    const needle = new THREE.Line( needle_geometry, needle_material );
    pins.add(needle);
    
    // make pinhead:    
    var point_of_interest = makeTextSprite(i , {
      position:  pin_position,
      fontcolor: 'rgba(255, 255, 255, 1)',
      fillcolor: 'rgba(0, 220, 255, 0.5)',
      fontsize:  100,
      bordercolor: 'rgba(0,0,0,0.2)',
      borderwidth: 1,
      scale: 0.01
    });
    point_of_interest.name = i;
    PointsOfInterest.add(point_of_interest);
  }
  GlobeGroup.add(pins);
  GlobeGroup.add(PointsOfInterest);
}



function createCoordAxes(parent, vector_length){ 
  const coord_axes = new THREE.Group();

  var geom = new THREE.BufferGeometry().setFromPoints( [new THREE.Vector3(0,0,0), new THREE.Vector3(vector_length,0,0)] );
  var matl = new THREE.LineBasicMaterial({color: 0xff0000, opacity: 0.2});
  var coord_axis = new THREE.Line( geom, matl );
  coord_axes.add(coord_axis);

  var geom = new THREE.BufferGeometry().setFromPoints( [new THREE.Vector3(0,0,0), new THREE.Vector3(0,vector_length,0)] );
  var matl = new THREE.LineBasicMaterial({ 	color: 0x00ff00, opacity: 0.2 });
  var coord_axis = new THREE.Line( geom, matl );
  coord_axes.add(coord_axis);
  
  var geom = new THREE.BufferGeometry().setFromPoints( [new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,vector_length)] );
  var matl = new THREE.LineBasicMaterial({ 	color: 0x0000ff, opacity: 0.2 });
  var coord_axis = new THREE.Line( geom, matl );
  coord_axes.add(coord_axis);

  parent.add(coord_axes);
  return coord_axes;
}


function onWindowResize(){
  width = document.documentElement.clientWidth;
  height = document.documentElement.clientHeight;
  console.log("resizing to " + width + " x " + height + " px");
  camera.aspect = document.documentElement.clientWidth / document.documentElement.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( width, height );
}


/*
function updateScreenPosition(offset) {
  let styleString;
  let poi = new THREE.Vector3(
  this.props.annotationPositions[i].position3D.x,
  this.props.annotationPositions[i].position3D.y + offset,
  this.props.annotationPositions[i].position3D.z 

  poi.project(this.camera);
  poi.x = Math.round((0.5 + poi.x / 2) * this.renderer.domElement.width);
  poi.y = Math.round((0.5 - poi.y / 2) * this.renderer.domElement.height);
   
  styleString = "top: " + poi.y + "px; left: " + poi.x + "px;";
  this.annotations[i].setAttribute(`style`, `${styleString}`);
}

//z-axis test to reverse position of horizontal annotations (ic1,ic4)
if (this.camera.position.z < 0 && !this.state.leftSideRotation) 
  {  this.setState({ leftSideRotation: true });  } 
else if (this.camera.position.z >= 0 && this.state.leftSideRotation)
  {  this.setState({ leftSideRotation: false }); }
};
*/

