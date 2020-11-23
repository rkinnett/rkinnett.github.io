// ...
// Based on 
// Created by Bjorn Sandvik - thematicmapping.org

//import * as THREE from './three.module.js';
//import { OrbitControls } from './OrbitControls.js';

import * as THREE from "https://threejs.org/build/three.module.js";
import { OrbitControls } from "https://threejs.org/examples/jsm/controls/OrbitControls.js";

let camera, controls, scene, renderer, ephem, options, sun, globe, labels, pins, PointsOfInterest, stars, GlobeGroup, fakeSun, sunVec;

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

const touch_enabled = ( 'ontouchstart' in window ) ||  ( navigator.maxTouchPoints > 0 ) || ( navigator.msMaxTouchPoints > 0 ); 
console.log("touch enabled: " + touch_enabled);

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
  subSunLat: 0,
  subSunLon: 0,
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
  setupKeyControls();

  console.log(renderer);
  renderer.domElement.addEventListener("webglcontextlost", function(event){  
    event.preventDefault();
    //cancelRequestAnimationFrame(requestId);
    alert("webgl crashed?");
    console.log("webgl crashed?");
    console.log(event);
  }, false);
  

  scene = new THREE.Scene();
  
  camera = new THREE.PerspectiveCamera(15, width/height, 0.01, 250);
  camera.position.x = options.cameraDist;
  camera.up.set(0,0,1);
  console.log(camera);
  scene.add(camera);

  scene.add(new THREE.AmbientLight(0x111111));  // faint background light
  
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

  // make a fake sun (useful for troubleshooting sun positioning):
  fakeSun = new THREE.Mesh(new THREE.SphereBufferGeometry(0.1, 32, 24), new THREE.MeshBasicMaterial({ color: "yellow" }));
  fakeSun.position.set(globe_radius*1.2, 0, 0);
  //scene.add(fakeSun);
  
  sun = new THREE.PointLight(0xffffff, 1, 1000, 1);
  sun.rotateX(Math.PI/2);  // reorient to z-up
  sun.position.set(options.sunPlaneDist,0,0);
  camera.add(sun);
  //placeSun();

  sunVec = fakeSun.position;

  var stars = createStars(200);

  labels = new THREE.Mesh();
  createLabels(globe_radius*1.01, segments);

  controls = new OrbitControls(camera, renderer.domElement );
  //controls.enablePan = false;
  controls.enableKeys = false;

  // need these for gui controls:
  var ephemQueryNowFcn = { add:function(){ showNow() }};
  var ephemQueryUtcFcn = { add:function(){ showSpecificTime()  }};
  var searchForFeatureFcn = { add:function(){ searchForFeature()  }};


  var gui = new dat.GUI();
  gui.add(options, 'subSunLon', -360, 360).listen().name("sun az").onChange(function(val){placeSun()});
  gui.add(options, 'subSunLat', -26, 26).listen().name("sun el").onChange(function(val){placeSun()});
  gui.add(options, 'rotation', 0, 6.2832).listen().name("planet rotation").onChange(function(val){ GlobeGroup.rotation.z = val; });
  gui.add(options, 'northUp').listen().name("north up").onChange(function(){ setPoleOrientation() });
  gui.add(options, 'mirror').listen().onChange(function(boolMirror){ setMirroring(boolMirror) });
  gui.add(options, 'showPins').listen().name("Points of Interest").onChange(function(){ togglePins() });
  gui.add(options, 'showCoordFrame').listen().name("Coordinate Axes").onChange(function(val){ GlobeCoordAxes.visible = val });
  gui.add(options, 'mapFile',mapFiles).listen().name("Base map").onChange(function(){changeMap()});
  gui.add(options, 'labels_sel',["none","coarse","fine"]).listen().name("Labels").onChange(function(){changeLabels()});
  gui.add(options, 'labels_opacity',0,1).listen().name("labels opacity").onChange(function(){labels.material.opacity = options.labels_opacity});
  gui.add(options, 'bumpScale',0,0.1).listen().name("texture scale").onChange(function(val){globe.material.bumpScale=val;});
  gui.add(options, 'r',0.6,1).listen().name("red").onChange(function(val){globe.material.color.r=val;});
  gui.add(options, 'g',0.6,1).listen().name("green").onChange(function(val){globe.material.color.g=val;});
  gui.add(options, 'b',0.6,1).listen().name("blue").onChange(function(val){globe.material.color.b=val;});
  gui.add(ephemQueryNowFcn,'add').name("Show now");
  gui.add(ephemQueryUtcFcn,'add').name("Show specific time");
  gui.add(searchForFeatureFcn,'add').name("Search");


  PointsOfInterest = new THREE.Group();
  pins = new THREE.Group();
  //PointsOfInterest = new THREE.Points();
  //if(linearFloatTexturesSupported) createPins(globe_radius*1.02, globe_radius*0.01, 0x66ddff);
  createPins(globe_radius*1.02, 0.004, 0x66ddff);

  render();

  console.log(scene);
  
  loadEphemData(showNow);

  window.globals = {webglEl, camera, controls, scene, renderer, ephem, options, sun, globe, labels, pins, PointsOfInterest, GlobeGroup, fakeSun, sunVec};
	window.addEventListener( "mousemove", onDocumentMouseMove, {passive: true}, false );
 // window.addEventListener( "mouseclick", onDocumentClick, {passive: true}, false );
  if(touch_enabled) window.addEventListener('touchend', onTouch, false);
}





function searchForFeature(){
  var searchPhrase = prompt("Search word/phrase:").toLowerCase();
  console.log("Search function input dialog response:  " + searchPhrase);

  // handle empty response (cancel)
  if(searchPhrase == null){
    console.log("empty response");
    return;
  }
  
  console.log("searching for feature..");
  for(var i=0; i<poi_names.length; i++) {
    if (poi_names[i].toLowerCase().match(searchPhrase)){
      console.log("found it! (" + i + ":" + poi_names[i] + ")");
      console.log("going to " + data_lats[i] + "N, " + (360-data_lons[i])%360 + "W");
      placeCamera(data_lats[i], (360-data_lons[i])%360);
      showPointOfInterestInfo(i);
      return;
    }
  }
  
  alert("Sorry, could not find requested feature.");
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


function setupKeyControls() {
  document.onkeydown = function(e) {
    const nudgeAngle = e.shiftKey? 0.01 : 0.001;
    console.log("Button pressed: " + (e.shiftKey?"shift+":"") + e.keyCode);
    switch (e.keyCode) {
      case 37:  // left arrow
      nudgeCamera("left", nudgeAngle);
      break;
      case 38: // up arrow
      nudgeCamera("up", nudgeAngle);      
      //GlobeGroup.rotation.y -= 0.1;
      break;
      case 39: // right arrow
      nudgeCamera("right", nudgeAngle);
      //GlobeGroup.rotateZ(-0.01);
      break;
      case 40: //down arrow
      nudgeCamera("down", nudgeAngle);
      //GlobeGroup.rotation.y += 0.1;
      break;
      
      case 70:
      if(e.ctrlKey) searchForFeature();
      e.preventDefault();
      break; 
      
    }
    

    
  };
}

function nudgeCamera(direction, angle){
  const rotAxis = new THREE.Vector3();
  switch(direction){
    case "up":
      rotAxis.set(camera.position.y, -1*camera.position.x, 0);
      break;
    case "down":
      rotAxis.set(-1*camera.position.y, camera.position.x, 0);
      break;
    case "left":
      rotAxis.set(0, 0, -1);
      break;
    case "right":
      rotAxis.set(0, 0, 1);
      break;
    default:
      return;
  }
  GlobeGroup.rotateOnAxis( rotAxis.normalize(), angle);
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
    sun.position.y *= -1;
    sun.position.x *= -1;
  }
}


function togglePins(){
  document.getElementById('poi_container').display = options.showPins ? 'block' : 'none';
  pins.visible = options.showPins;
  PointsOfInterest.visible = options.showPins;
}

function onDocumentMouseMove( event ) {
  if(options.showPins){
    checkPins(event);
  } else {
    displayLatLon(event);
  }
}

function onTouch(event) {
  console.log("click event");
  var foundMatch = false;
  if(options.showPins) {
    foundMatch = checkPins(event);
  }
  if(!foundMatch){
    displayLatLon(event);
  }
}

function displayLatLon(event){
  const intersects = getIntersects( event.layerX, event.layerY, globe );
  if(intersects.length>0){
    var pointOfIntersection = intersects[0].point;
    //console.log(pointOfIntersection);
    document.getElementById('poi_image').src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; //1px transparent image
    const poiCaption = document.getElementById('poi_info');
    poiCaption.innerHTML = "";
    //poiCaption.innerHTML += "x:   " + pointOfIntersection.x.toFixed(5) + ' <br>';
    //poiCaption.innerHTML += "y:   " + pointOfIntersection.y.toFixed(5) + ' <br>';
    //poiCaption.innerHTML += "z:   " + pointOfIntersection.z.toFixed(5) + ' <br>';
    poiCaption.innerHTML += "lat: " + (Math.asin(pointOfIntersection.z/globe_radius)/radsPerDeg).toFixed(2) + 'N <br>';
    poiCaption.innerHTML += "lon: " + ((Math.atan2(pointOfIntersection.y, pointOfIntersection.x)/radsPerDeg*-1+360)%360).toFixed(2) + 'W <br>';
  }
}

function checkPins(event){
  const intersects = getIntersects( event.layerX, event.layerY, PointsOfInterest );
  //console.log(intersects.length);
  if ( intersects.length > 0 ) {
    const res = intersects.filter( function(res){
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
        return true;
      }
    }
  }
  return false;
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

function showPointOfInterestInfo(index){
  // note: the data from Google Mars uses non-standard E longitude
  // ref: https://link.springer.com/article/10.1007/s10569-017-9805-5
  
  var poiCaption = document.getElementById('poi_info');
  //console.log(poiCaption);
  console.log(data[index]);
  const info = data[index].split("#");
  //console.log(info);

  // load thumbnail if available, otherwise use 1px placeholder:
  if(data_imgs[index]) {
    var imgurl = 'https://www.google.com/mars/' + data_imgs[index];
    console.log("showing info image: " + imgurl);
    document.getElementById('poi_image').src = imgurl;
  } else {
    document.getElementById('poi_image').src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; //1px transparent image    
  }

  var featureLocation = data_lats[index].toFixed(2) + 'N, ' + ((360-1*data_lons[index])%360).toFixed(2) + 'W';

  // populate description depending on feature type:
  poiCaption.innerHTML = "";
  const featureType = data_type[index];
  switch(featureType){
    case 'a':  /*spacecraft*/   
      poiCaption.innerHTML += '<p><b>Spacecraft:&nbsp;<a href="' + data_urls[index] + '" target="_blank">' + info[1] + '</a></b></p>';
      poiCaption.innerHTML += 'Location:&nbsp;&nbsp;&nbsp;' + featureLocation + '<br />';
      poiCaption.innerHTML += 'Launched:&nbsp;&nbsp;&nbsp;' + info[0] + ' <br />';
      poiCaption.innerHTML += "Result:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;" + info[2] + " <br />";
      break;
    case 'b':  /*stories*/
      poiCaption.innerHTML += '<p><b>Article:&nbsp;&nbsp;&nbsp;&nbsp;<a href="' + data_urls[index] + '" target="_blank">' + info[1] + '</a></b></p>';
      poiCaption.innerHTML += 'Location:&nbsp;&nbsp;&nbsp;' + featureLocation + '<br />';
      poiCaption.innerHTML += "Source:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;" + info[2] + " <br />";
      poiCaption.innerHTML += 'Date:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + info[0] + ' <br />';
      break;
    default:
      poiCaption.innerHTML += '<p><b><u>' + info[1] + '</u></b></p>';
      poiCaption.innerHTML += "Type:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;" + feature_types[data_type[index]] + " <br />";
      poiCaption.innerHTML += 'Location:&nbsp;&nbsp;&nbsp;' + featureLocation + '<br />';
      poiCaption.innerHTML += "Named in:&nbsp;&nbsp;&nbsp;" + info[0] + " <br />";
      poiCaption.innerHTML += "Named for:&nbsp;&nbsp;" + info[2] + " <br />";      
      if(data_urls[index]) poiCaption.innerHTML += '<a href="' + data_urls[index] + '" target="_blank">Reference</a> <br />';
      break;
  }
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
  
  // place camera to sub-observer lat/lon
  placeCamera(ephem.ObsSubLat, ephem.ObsSubLon);
    
  // move sun to sub-sun lat/lon
  options.subSunLat = ephem.SunSubLat;
  options.subSunLon = ephem.SunSubLon;
  placeSun();
}

function placeCamera(lat, lon){
  GlobeGroup.rotation.z = 0; // re-center globe
  console.log("setting camera position to lat " + lat + ", lon " + lon);
  camera.position.set(
    options.cameraDist * Math.cos(-1*lon*radsPerDeg) * Math.cos(lat*radsPerDeg),
    options.cameraDist * Math.sin(-1*lon*radsPerDeg) * Math.cos(lat*radsPerDeg),
    options.cameraDist * Math.sin(lat*radsPerDeg),
  );
  controls.update();
  console.log(camera.position);
}

function placeSun(){
  console.log("setting sun position to lat " + options.subSunLat + ", lon " + options.subSunLon);
  scene.add(sun);
  sun.position.set(
    options.sunPlaneDist * Math.cos(-1*options.subSunLon*radsPerDeg) * Math.cos(options.subSunLat*radsPerDeg),
    options.sunPlaneDist * Math.sin(-1*options.subSunLon*radsPerDeg) * Math.cos(options.subSunLat*radsPerDeg),
    options.sunPlaneDist * Math.sin(options.subSunLat*radsPerDeg),
  );
  camera.attach(sun);
  console.log(fakeSun.position);
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
  //const bumpMapFile = 'images/mgs_mola_elevation_map_reduced.jpg';
  
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

function createPins(vector_length, poi_size, pin_color) {
  togglePins();

  // make materials:
  var poiMaterial_generic = new THREE.SpriteMaterial( { 
    map: new THREE.TextureLoader().load('images/poi.png'),
    sizeAttenuation: false, 
    opacity: 0.5,
  });
  
  var poiMaterial_lander = new THREE.SpriteMaterial( { 
    map:  new THREE.TextureLoader().load('images/poi_lander.png'),
    sizeAttenuation: false, 
    opacity: 0.5,
  });
  var poiMaterial_article = new THREE.SpriteMaterial( { 
    map:  new THREE.TextureLoader().load('images/poi_camera.png'),
    sizeAttenuation: false, 
    opacity: 0.5,
  });

  for(var i=0; i<data_lats.length; i++){
  //for(var i=0; i<200; i++){
    
    // note: the data from Google Mars uses non-standard E longitude
    // ref: https://link.springer.com/article/10.1007/s10569-017-9805-5
    
    console.log("Pin " + i + " data: " + data[i]);
    const pin_position = new THREE.Vector3(
      vector_length * Math.cos(data_lons[i]*radsPerDeg) * Math.cos(data_lats[i]*radsPerDeg),
      vector_length * Math.sin(data_lons[i]*radsPerDeg) * Math.cos(data_lats[i]*radsPerDeg),
      vector_length * Math.sin(data_lats[i]*radsPerDeg),
    );

    // make needle:
    const needle_geometry = new THREE.BufferGeometry().setFromPoints( [new THREE.Vector3(0,0,0), pin_position] );
    const needle_material = new THREE.LineBasicMaterial({ 	color: pin_color, opacity: 0.15 });
    const needle = new THREE.Line( needle_geometry, needle_material );
    pins.add(needle);
    
    // make pinhead: 
    var poiGeometry = new THREE.Geometry();
    poiGeometry.vertices.push(pin_position);
    
    var poiMaterial = new THREE.SpriteMaterial( { 
      sizeAttenuation: false, 
      opacity: 0.5,
    });
    
    var this_poi_matl;
    var this_poi_size = poi_size;
    const featureType = data_type[i];
    switch(featureType) {
      case 'a':  /* spacecraft */
        this_poi_matl = poiMaterial_lander;
        this_poi_size *= 2;
        console.log(poi_size);
        break;
      case 'b':  /* article */
        this_poi_matl = poiMaterial_article;
        this_poi_size *= 1.4;
        break;
      default: 
        this_poi_matl = poiMaterial_generic;
        break;
    }

    var point_of_interest = new THREE.Sprite(this_poi_matl);
    point_of_interest.scale.set(this_poi_size, this_poi_size, this_poi_size);
    point_of_interest.position.copy(pin_position);
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

