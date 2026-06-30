
//import * as THREE from './three.module.js';
//import { OrbitControls } from './OrbitControls.js';

//import * as THREE from "https://cdnjs.cloudflare.com/ajax/libs/three.js/r121/three.module.js";
//import { OrbitControls } from "https://threejs.org/examples/jsm/controls/OrbitControls.js";

import * as THREE from 'https://unpkg.com/three@0.121.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.121.1/examples/jsm/controls/OrbitControls.js';
import { LineSegments2 } from 'https://unpkg.com/three@0.121.1/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'https://unpkg.com/three@0.121.1/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'https://unpkg.com/three@0.121.1/examples/jsm/lines/LineMaterial.js';

let camera, controls, scene, renderer, ephem, options, sun, globe, PointsOfInterest, stars, GlobeGroup, fakeSun, sunVec, canvas;
const raycaster = new THREE.Raycaster();
const mouseVector = new THREE.Vector3();
const globeCenterWorld = new THREE.Vector3();
let leaderLinesGroup = null;
let leaderOutlineLine = null;
let leaderCoreLine = null;
let leaderOutlinePositions = null;
let leaderCorePositions = null;
let leaderLinesDirty = false;
let globeDisplacementBias = -0.01;

const ephemFile = 'js/ephem_2026_to_2036.json';
const craterFile = 'data/craters.csv';
const featuresFile = 'data/features.csv';
const landingSitesFile = 'data/landing_sites.csv';

const mapFiles = [
  'lroc_color_2k.jpg',
  'lroc_color_16bit_srgb_8k.jpg',
  'lroc_color_poles_16k.jpg',
];

const webglEl = document.getElementById('webgl');
/*if (!Detector.webgl) {
  Detector.addGetWebGLMessage(webglEl);
  return;
}*/

const touch_enabled = ( 'ontouchstart' in window ) ||  ( navigator.maxTouchPoints > 0 ) || ( navigator.msMaxTouchPoints > 0 ); 
console.log("touch enabled: " + touch_enabled);


var width  = document.documentElement.clientWidth,
  height = document.documentElement.clientHeight;

  
// Global params
var globe_radius   = 0.5,
  segments = 256,
  rotation = 0,
  globeLoaded = false,
  craterCsvText = null,
  featuresCsvText = null,
  landingSitesCsvText = null,
  featureRecords = [],
  displacementImageData = null,
  displacementImageWidth = 0,
  displacementImageHeight = 0,
  radsPerDeg = Math.PI/180,
  dialogOpen = false;

const loadingState = {
  assetsLoaded: false,
  featureDataLoaded: false,
  ephemLoaded: false,
};

options = {
  mirror:  false,
  mapFile: 'lroc_color_4k.jpg',
  bumpScale: 0.005,
  displacementScale: 0.01,
  cameraDist: 7,
  sunPlaneDist: 60,
  rotation: 0,
  r: 1,
  g: 1,
  b: 1,
  labelScale: 0.04,
  labelFontSize: 28,
  labelTextColor: '#ffffff',
  labelStrokeColor: '#000000',
  labelBackgroundOpacity: 0.0,
  labelOpacity: 0.8,
  labelStrokeWidth: 2,
  showLabels: true,
  showLabelLeaders: true,
  leaderLabelRadialOffset: 0.2,
  initToCurrent: false,
  showStars: true,
  showMoon: true,
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


init();


function init(){
  startLoadingManager();
  
  window.addEventListener('dblclick',   onDoubleClick, false);  // center view on clicked lat/lon position
  window.addEventListener('keydown',    onKeyDown, false);  // handle key controls:  arrow keys, ctrl-f, etc
  window.addEventListener('resize',     onWindowResize, {passive: true}, false );

  console.log("initializing renderer");
  renderer = new THREE.WebGLRenderer(); 
  renderer.setSize(width, height);
  window.renderer = renderer;
  webglEl.appendChild(renderer.domElement);
  console.log(renderer);
  var context = renderer.getContext();
  canvas = context.canvas;
  renderer.domElement.addEventListener("webglcontextlost", function(event){  
    event.preventDefault();
    //cancelRequestAnimationFrame(requestId);
    alert("webgl crashed?");
    console.log("webgl crashed?");
    console.log(event);
  }, false);

  
  scene = new THREE.Scene();
  window.scene = scene;
  
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


  controls = new OrbitControls(camera, renderer.domElement );
  //controls.enablePan = false;
  controls.enableKeys = false;

  // need these for gui controls:
  var ephemQueryNowFcn = { add:function(){ showNow() }};
  var ephemQueryUtcFcn = { add:function(){ showSpecificTime()  }};
  var searchForFeatureFcn = { add:function(){ searchForFeature()  }};
  var screenshotFcn = { add:function(){ screenShot() }};


  var gui = new dat.GUI();

  const gui_folder_illumination = gui.addFolder('Illumination');
  gui_folder_illumination.add(options, 'subSunLon', -360, 360).listen().name("sun az").onChange(function(val){placeSun()});
  gui_folder_illumination.add(options, 'subSunLat', -26, 26).listen().name("sun el").onChange(function(val){placeSun()});

  const gui_folder_orientation = gui.addFolder('Orientation');
  gui_folder_orientation.add(options, 'rotation', 0, 6.2832).listen().name("planet rotation").onChange(function(val){ GlobeGroup.rotation.z = val; });
  gui_folder_orientation.add(options, 'northUp').listen().name("north up").onChange(function(){ setPoleOrientation() });
  gui_folder_orientation.add(options, 'mirror').listen().onChange(function(boolMirror){ setMirroring(boolMirror) });
  gui_folder_orientation.add(options, 'showCoordFrame').listen().name("Coordinate Axes").onChange(function(val){ GlobeCoordAxes.visible = val });

  const gui_folder_appearance = gui.addFolder('Appearance');
  gui_folder_appearance.add(options, 'showMoon').listen().name("Moon").onChange(function(){ toggleMoon(); });
  gui_folder_appearance.add(options, 'showStars').listen().name("Stars").onChange(function(){ toggleStars(); });
  gui_folder_appearance.add(options, 'mapFile',mapFiles).listen().name("Base map").onChange(function(){changeMap()});
  gui_folder_appearance.add(options, 'bumpScale',0,0.1).listen().name("texture scale").onChange(function(val){ setGlobeMaterialProperty('bumpScale', val); });
  gui_folder_appearance.add(options, 'displacementScale',0,0.1).listen().name("displacement scale").onChange(function(val){
    setGlobeMaterialProperty('displacementScale', val);
    updateLabelsPosition();
  });
  // gui_folder_appearance.add(options, 'r',0.6,1).listen().name("red").onChange(function(val){globe.material.color.r=val;});
  // gui_folder_appearance.add(options, 'g',0.6,1).listen().name("green").onChange(function(val){globe.material.color.g=val;});
  // gui_folder_appearance.add(options, 'b',0.6,1).listen().name("blue").onChange(function(val){globe.material.color.b=val;});

  const gui_folder_labels = gui.addFolder('Labels');
  gui_folder_labels.add(options, 'showLabels').listen().name("show labels").onChange(function(){ updateLabelsVisibility(); });
  gui_folder_labels.add(options, 'showLabelLeaders').listen().name("leader lines").onChange(function(){ updateLabelsVisibility(); });
  gui_folder_labels.add(options, 'leaderLabelRadialOffset', 0, 2).step(0.01).listen().name("leader radial offset");
  gui_folder_labels.add(options, 'labelScale', 0.01, 0.2).listen().name("size").onChange(function(){ refreshLabels(); });
  //gui_folder_labels.add(options, 'labelFontSize', 12, 96).step(1).listen().name("font size").onChange(function(){ refreshLabels(); });
  gui_folder_labels.add(options, 'labelOpacity', 0, 1).listen().name("opacity").onChange(function(){ refreshLabels(); });
  //gui_folder_labels.add(options, 'labelStrokeWidth', 0, 14).step(1).listen().name("outline width").onChange(function(){ refreshLabels(); });
  // gui_folder_labels.addColor(options, 'labelTextColor').name("text color").onChange(function(){ refreshLabels(); });
  // gui_folder_labels.addColor(options, 'labelStrokeColor').name("outline color").onChange(function(){ refreshLabels(); });
  
  gui.add(ephemQueryNowFcn,'add').name("Show now");
  gui.add(ephemQueryUtcFcn,'add').name("Show specific time");
  gui.add(searchForFeatureFcn,'add').name("Search");
  gui.add(screenshotFcn,'add').name('Screenshot');


  PointsOfInterest = new THREE.Group();
  PointsOfInterest.name = 'featureLabels';
  PointsOfInterest.visible = options.showMoon && options.showLabels;
  GlobeGroup.add(PointsOfInterest);

  loadFeatureData();

  render();

  console.log(scene);
  
  loadEphemData(showNow);

  // make key variables accessible in console:
  window.globals = {webglEl, camera, controls, scene, renderer, ephem, options, sun, globe, GlobeGroup, fakeSun, sunVec};
}




function onDoubleClick(event){
  console.log("double click event");
  // Center camera position at double-clicked position:
  const intersects = getIntersects( event.layerX, event.layerY, globe );
  if(intersects.length>0){
    var pointOfIntersection = intersects[0].point;
    var lat = Math.asin(pointOfIntersection.z/globe_radius)/radsPerDeg;
    var lon = Math.atan2(pointOfIntersection.y, pointOfIntersection.x)/radsPerDeg*-1;
    console.log("lat: " + lat.toFixed(2) + "N, lon: " + lon.toFixed(2) + "W");
    placeCamera(lat, lon);
  }
}

function onKeyDown(event) {
  if(dialogOpen) return;
  
  console.log("Button pressed: " + (event.shiftKey?"shift+":"") + event.keyCode);
  
  // holding shift with arrow moves faster, holding control with arrow moves slower:
  const nudgeAngle = event.shiftKey? 0.01 : event.ctrlKey? 0.0002 : 0.001;
  switch (event.keyCode) {
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
    case 70: // f key
      if(event.ctrlKey) searchForFeature();
      event.preventDefault();
      break; 
    default:
      console.log("unregistered key");
  }
}

function onWindowResize(){
  width = document.documentElement.clientWidth;
  height = document.documentElement.clientHeight;
  console.log("resizing to " + width + " x " + height + " px");
  camera.aspect = document.documentElement.clientWidth / document.documentElement.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( width, height );
  if(leaderOutlineLine && leaderOutlineLine.material && leaderOutlineLine.material.resolution){
    leaderOutlineLine.material.resolution.set(width, height);
  }
  if(leaderCoreLine && leaderCoreLine.material && leaderCoreLine.material.resolution){
    leaderCoreLine.material.resolution.set(width, height);
  }
}

function startLoadingManager(){
  const status = document.getElementById('status_container');
  function setStatus(text, color){
    if(!status) return;
    status.style.color = color;
    status.innerText = text;
  }

  function updateReadyStatus(){
    if(loadingState.assetsLoaded && loadingState.featureDataLoaded && loadingState.ephemLoaded){
      setStatus("Ready", "#6f6");
      return;
    }

    var pending = [];
    if(!loadingState.assetsLoaded) pending.push("assets");
    if(!loadingState.featureDataLoaded) pending.push("features");
    if(!loadingState.ephemLoaded) pending.push("ephemeris");
    setStatus("Loading " + pending.join(", "), "orange");
  }

  window.updateLoadingStatus = updateReadyStatus;

  THREE.DefaultLoadingManager.onStart = function ( url, itemsLoaded, itemsTotal ) {
    console.log( 'Started loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.' );
    setStatus("Loading assets 0/" + itemsTotal, "orange");
  };
  THREE.DefaultLoadingManager.onProgress = function ( url, itemsLoaded, itemsTotal ) {
    console.log( 'Loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.' );
    setStatus("Loading assets " + itemsLoaded + "/" + itemsTotal, "orange");
  };
  THREE.DefaultLoadingManager.onLoad = function ( ) {
    console.log( 'Loading Complete!');
    loadingState.assetsLoaded = true;
    updateReadyStatus();
  };
}



function render() {
  controls.update();
  requestAnimationFrame(render);
  updateLabelsInView();
  renderer.render(scene, camera);
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

function searchForFeature(){
  dialogOpen = true;
  var searchPhrase = prompt("Search feature name:");
  dialogOpen = false;
  console.log("Search function input dialog response:  " + searchPhrase);

  // handle empty response (cancel)
  if(searchPhrase == null || searchPhrase.length == 0){
    console.log("empty response");
    return;
  }

  searchPhrase = searchPhrase.toLowerCase().trim().replace(/^['\"]+|['\"]+$/g, '');
  if(searchPhrase.length === 0){
    return;
  }
  if(!featureRecords || featureRecords.length === 0){
    alert("Sorry, feature data is not loaded yet.");
    return;
  }

  console.log("searching feature list..");
  var bestMatch = null;
  var bestMatchPos = Number.POSITIVE_INFINITY;

  for(var i = 0; i < featureRecords.length; i++){
    var featureName = featureRecords[i].name.toLowerCase();
    var matchPos = featureName.indexOf(searchPhrase);
    if(matchPos > -1 && matchPos < bestMatchPos){
      bestMatch = featureRecords[i];
      bestMatchPos = matchPos;
    }
  }

  if(bestMatch){
    console.log("going to feature " + bestMatch.name + " at " + bestMatch.lat + "N, " + bestMatch.lon + "W");
    placeCamera(bestMatch.lat, bestMatch.lon);
  } else {
    alert("Sorry, could not find requested feature.");
  }
}


function screenShot(){
  render();
  canvas.toBlob((blob) => {
    saveBlob(blob, 'moon_globe.png');
  });    
}


const saveBlob = (function() {
  const a = document.createElement('a');
  document.body.appendChild(a);
  a.style.display = 'none';
  return function saveData(blob, fileName) {
     const url = window.URL.createObjectURL(blob);
     a.href = url;
     a.download = fileName;
     a.click();
  };
}());


function toggleStars(){
  stars.visible = options.showStars;
}

function toggleMoon(){
  globe.visible = options.showMoon;
  updateLabelsVisibility();
}

function updateLabelsVisibility(){
  if(PointsOfInterest){
    PointsOfInterest.visible = options.showLabels;
  }
}


function getIntersects(x, y, group) {
  x = ( x / window.innerWidth ) * 2 - 1;
  y = - ( y / window.innerHeight ) * 2 + 1;
  mouseVector.set( x, y, 0.5 );
  raycaster.setFromCamera( mouseVector, camera );
  return raycaster.intersectObject( group, true );
}


function showNow(){
  var dateQuery = new Date();
  console.log("Time now:  " + dateQuery);
  interpolateEphemeris(dateQuery);
  renderEphemeris();
}

function showSpecificTime(){
  console.log("ephemQueryUtcFcn");
  dialogOpen = true;
  var strResponse = prompt("UTC time  (YYYY-MM-DD HH:MM):");
  dialogOpen = false;
  console.log("Time input dialog response:  " + strResponse);

  // handle empty response (cancel)
  if(strResponse == null){
    console.log("empty response");
    return;
  }

  // if received a response, then make sure user input meets required format:
  if(! (new RegExp('20[0-9]{2}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}').test(strResponse) )){
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

  // round down to start of day:
  var ephem_period = 24;
  var hourRoundedDown = Math.floor(dayFrac*24/ephem_period)*ephem_period;
  var strDateInterpBelow = strQueryDate + " " + (hourRoundedDown<10?"0":"") + hourRoundedDown + ":00";
  console.log("strDateInterpBelow: " + strDateInterpBelow);
  var interpRatio = (dayFrac*24 % ephem_period) / ephem_period;
  console.log("interp ratio: " + interpRatio);
  
  // get interp upper bound:
  var strDateInterpAbove = new Date(new Date(strDateInterpBelow.replace(" ","T") + ":00Z").valueOf() + ephem_period*60*60*1000).toISOString().substring(0,16).replace(/T/g, " ");
  console.log("interp bounds:  " + strDateInterpBelow + ", " + strDateInterpAbove);

  // get entries before and after query time:
  var ephemBelowEntry = ephem.data && ephem.data[strDateInterpBelow];
  var ephemAboveEntry = ephem.data && ephem.data[strDateInterpAbove];
  if(!ephemBelowEntry || !ephemBelowEntry[0] || !ephemAboveEntry || !ephemAboveEntry[0]){
    console.log("missing ephemeris records for interpolation bounds");
    console.log(strDateInterpBelow + " => " + (ephemBelowEntry ? "found" : "missing"));
    console.log(strDateInterpAbove + " => " + (ephemAboveEntry ? "found" : "missing"));
    return;
  }

  var ephemBelow = ephemBelowEntry[0];
  console.log(ephemBelow);
  var ephemAbove = ephemAboveEntry[0];
  console.log(ephemAbove);
  
  // interpolate sub-observer longitude:
  ephem.ObsSubLon = interpolateLongitude(ephemBelow.ObsSubLon, ephemAbove.ObsSubLon, interpRatio);
  console.log(ephem.ObsSubLon);

  // interpolate sub-observer latitude:
  ephem.ObsSubLat = (ephemBelow.ObsSubLat + interpRatio*(ephemAbove.ObsSubLat - ephemBelow.ObsSubLat));
  
  // interpolate sub-sun point
  ephem.SunSubLon = interpolateLongitude(ephemBelow.SunSubLon, ephemAbove.SunSubLon, interpRatio);
  ephem.SunSubLat = (ephemBelow.SunSubLat + interpRatio*(ephemAbove.SunSubLat - ephemBelow.SunSubLat));

  console.log("calculated ephemeris:");
  console.log(ephem);
}

function interpolateLongitude(lonStart, lonEnd, ratio){
  var start = ((lonStart % 360) + 360) % 360;
  var end = ((lonEnd % 360) + 360) % 360;
  var delta = ((end - start + 540) % 360) - 180;
  return ((start + ratio * delta) % 360 + 360) % 360;
}

function loadEphemData(callback){
  console.log("callback: " + callback);
  console.log("typeof callback: " + (typeof callback));
  console.log("loading ephemeris file");
  $.getJSON(ephemFile)
  .done(function(data) { 
    console.log("done"); 
    ephem.data = data;
    console.log("testing ephem lookup:  ");
    var ephemKeys = Object.keys(data || {});
    if(ephemKeys.length > 0 && data[ephemKeys[0]] && data[ephemKeys[0]][0]){
      console.log(data[ephemKeys[0]][0]);
    } else {
      console.log("ephemeris file loaded but contains no usable rows");
    }
    ephem.loaded = true;
    loadingState.ephemLoaded = true;
    if(window.updateLoadingStatus) window.updateLoadingStatus();
    if(typeof callback == 'function' ) callback();
  })
  .fail(function(jqXHR, textStatus, errorThrown) {
    console.log("error " + textStatus);
    console.log(errorThrown);
    console.log("incoming Text " + jqXHR.responseText);
    const status = document.getElementById('status_container');
    if(status){
      status.style.color = "#f66";
      status.innerText = "Error loading ephemeris";
    }
  })
}

function loadFeatureData(){
  console.log("loading feature data files");
  Promise.all([
    fetchCsvText(craterFile),
    fetchCsvText(featuresFile),
    fetchCsvText(landingSitesFile),
  ])
    .then(function(csvTexts){
      craterCsvText = csvTexts[0];
      featuresCsvText = csvTexts[1];
      landingSitesCsvText = csvTexts[2];
      createLabels();
      loadingState.featureDataLoaded = true;
      if(window.updateLoadingStatus) window.updateLoadingStatus();
      console.log("loaded feature labels");
    })
    .catch(function(error){
      console.log("error loading feature data");
      console.log(error);
      const status = document.getElementById('status_container');
      if(status){
        status.style.color = "#f66";
        status.innerText = "Error loading feature data";
      }
    });
}

function fetchCsvText(filePath){
  return fetch(filePath)
    .then(function(response){
      if(!response.ok){
        throw new Error("failed to load data file " + filePath + ": " + response.status + " " + response.statusText);
      }
      return response.arrayBuffer();
    })
    .then(function(buffer){
      // Prefer UTF-8, but some source CSVs are legacy Windows-1252.
      var utf8Text = new TextDecoder('utf-8').decode(buffer);
      if(utf8Text.indexOf('\uFFFD') === -1){
        return utf8Text.normalize('NFC');
      }

      var fallbackText = new TextDecoder('windows-1252').decode(buffer);
      return fallbackText.normalize('NFC');
    });
}

function appendFeatureRecordsFromCsv(csvText, featureType){
  if(!csvText){
    return;
  }

  var type = featureType || 'feature';

  var rows = csvText.split(/\r?\n/);
  if(rows.length < 2){
    return;
  }

  var headers = rows[0].split(',').map(function(header){ return header.trim().toLowerCase(); });
  var nameIndex = headers.findIndex(function(header){
    return header.indexOf('name') >= 0 || header.indexOf('mission') >= 0 || header.indexOf('site') >= 0 || header.indexOf('feature') >= 0;
  });
  var latIndex = headers.findIndex(function(header){ return header.indexOf('lat') >= 0; });
  var lonIndex = headers.findIndex(function(header){ return header.indexOf('long') >= 0; });
  var diameterIndex = headers.findIndex(function(header){ return header.indexOf('diam') >= 0 || header.indexOf('width') >= 0; });

  if(nameIndex < 0 && headers.length > 0){
    nameIndex = 0;
  }

  if(nameIndex < 0 || latIndex < 0 || lonIndex < 0){
    return;
  }

  for(var i = 1; i < rows.length; i++){
    var row = rows[i].trim();
    if(row.length === 0){
      continue;
    }

    var columns = row.split(',');
    var featureName = (columns[nameIndex] || '').trim();
    var latString = (columns[latIndex] || '').trim();
    var lonString = (columns[lonIndex] || '').trim();
    var featureDiameter = diameterIndex >= 0 ? parseFloat(columns[diameterIndex]) : NaN;

    var featureLat = parseLatitude(latString);
    var featureLon = parseLongitude(lonString);

    if(isNaN(featureLat) || isNaN(featureLon) || featureName.length === 0){
      continue;
    }

    featureRecords.push({
      name: featureName,
      lat: featureLat,
      lon: featureLon,
      diameter: isNaN(featureDiameter) ? null : featureDiameter,
      featureType: type,
    });
  }
}

function createLabels(){
  if(!PointsOfInterest){
    return;
  }

  clearLabels();
  featureRecords = [];

  appendFeatureRecordsFromCsv(craterCsvText, 'crater');
  appendFeatureRecordsFromCsv(featuresCsvText, 'feature');
  appendFeatureRecordsFromCsv(landingSitesCsvText, 'landingSite');

  var minDiameter = Infinity;
  var maxDiameter = -Infinity;

  for(var i = 0; i < featureRecords.length; i++){
    var featureDiameter = featureRecords[i].diameter;
    if(featureDiameter !== null){
      minDiameter = Math.min(minDiameter, featureDiameter);
      maxDiameter = Math.max(maxDiameter, featureDiameter);
    }
  }

  if(minDiameter === Infinity || maxDiameter === -Infinity){
    minDiameter = 0;
    maxDiameter = 0;
  }

  var duplicateCoordCounts = {};
  for(var j = 0; j < featureRecords.length; j++){

    var feature = featureRecords[j];
    var coordKey = feature.lat.toFixed(4) + ',' + feature.lon.toFixed(4);
    var duplicateIndex = duplicateCoordCounts[coordKey] || 0;
    duplicateCoordCounts[coordKey] = duplicateIndex + 1;
    var duplicateOffset = duplicateIndex * globe_radius * 0.004;

    var diameterRange = maxDiameter - minDiameter;
    var normalizedDiameter = (feature.diameter === null || diameterRange <= 0) ? 0.5 : (feature.diameter - minDiameter) / diameterRange;
    var scaledDiameter = Math.pow(normalizedDiameter, 0.65);
    var sizeMultiplier = 0.5 + scaledDiameter;

    feature.surfaceLocal = latLonToGlobePoint(feature.lat, feature.lon, getLabelRadius(feature.lat, feature.lon));
    feature.duplicateOffset = duplicateOffset;
    feature.sizeMultiplier = sizeMultiplier;

    var isLandingSite = feature.featureType === 'landingSite';
    var labelSprite = createLabelSprite(
      feature.name,
      feature.diameter,
      minDiameter,
      maxDiameter,
      isLandingSite ? 1.0 : null,
      isLandingSite ? '#ffd84d' : options.labelTextColor
    );
    labelSprite.userData = {
      lat: feature.lat,
      lon: feature.lon,
      duplicateOffset: duplicateOffset,
    };
    feature.labelSprite = labelSprite;
    feature.leaderBatchIndex = j;
    feature.leaderVisible = false;
    feature.leaderStartLocal = null;
    feature.leaderEndLocal = null;

    PointsOfInterest.add(labelSprite);
  }

  createLeaderLinesBatch(featureRecords.length);

  updateLabelsPosition();
  updateLabelsVisibility();
}

function createLeaderLinesBatch(featureCount){
  disposeLeaderLinesBatch();
  if(!PointsOfInterest || !featureCount){
    return;
  }

  var valuesPerFeature = 6;
  leaderOutlinePositions = new Float32Array(featureCount * valuesPerFeature);
  leaderCorePositions = new Float32Array(featureCount * valuesPerFeature);

  var outlineGeometry = new LineSegmentsGeometry();
  outlineGeometry.setPositions(leaderOutlinePositions);
  var coreGeometry = new LineSegmentsGeometry();
  coreGeometry.setPositions(leaderCorePositions);

  var outlineMaterial = new LineMaterial({
    color: 0x000000,
    transparent: true,
    opacity: options.labelOpacity * 0.5,
    linewidth: 7,
    //depthTest: false,
    depthWrite: false,
  });
  outlineMaterial.resolution.set(width, height);

  var coreMaterial = new LineMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: options.labelOpacity,
    linewidth: 2,
    //depthTest: false,
    depthWrite: false,
  });
  coreMaterial.resolution.set(width, height);

  leaderOutlineLine = new LineSegments2(outlineGeometry, outlineMaterial);
  leaderOutlineLine.renderOrder = 9;
  leaderCoreLine = new LineSegments2(coreGeometry, coreMaterial);
  leaderCoreLine.renderOrder = 10;

  leaderLinesGroup = new THREE.Group();
  leaderLinesGroup.visible = false;
  leaderLinesGroup.add(leaderOutlineLine);
  leaderLinesGroup.add(leaderCoreLine);
  PointsOfInterest.add(leaderLinesGroup);
}

function disposeLeaderLinesBatch(){
  if(leaderLinesGroup && leaderLinesGroup.parent){
    leaderLinesGroup.parent.remove(leaderLinesGroup);
  }
  if(leaderOutlineLine && leaderOutlineLine.geometry){
    leaderOutlineLine.geometry.dispose();
  }
  if(leaderCoreLine && leaderCoreLine.geometry){
    leaderCoreLine.geometry.dispose();
  }
  if(leaderOutlineLine && leaderOutlineLine.material){
    leaderOutlineLine.material.dispose();
  }
  if(leaderCoreLine && leaderCoreLine.material){
    leaderCoreLine.material.dispose();
  }

  leaderLinesGroup = null;
  leaderOutlineLine = null;
  leaderCoreLine = null;
  leaderOutlinePositions = null;
  leaderCorePositions = null;
  leaderLinesDirty = false;
}

function getLabelRadius(lat, lon){
  var displacementOffset = getSurfaceDisplacementAtLatLon(lat, lon);
  var labelClearance = globe_radius * 0.005;
  return globe_radius + displacementOffset + labelClearance;
}

function updateLabelsPosition(){
  if(!featureRecords){
    return;
  }

  for(var i = 0; i < featureRecords.length; i++){
    var feature = featureRecords[i];
    if(!feature){
      continue;
    }
    var lat = feature.lat;
    var lon = feature.lon;
    var duplicateOffset = feature.duplicateOffset || 0;
    if(isNaN(lat) || isNaN(lon)){
      continue;
    }
    if(!feature.surfaceLocal){
      feature.surfaceLocal = latLonToGlobePoint(lat, lon, getLabelRadius(lat, lon));
    }
    feature.positionLocal = latLonToGlobePoint(lat, lon, getLabelRadius(lat, lon) + duplicateOffset);
    if(feature.labelSprite){
      feature.labelSprite.position.copy(feature.positionLocal);
    }
    updateLeaderLineGeometry(feature, feature.positionLocal, true);
  }
  commitLeaderLineGeometry();
}

function updateLeaderLineGeometry(feature, lineEndLocal, isVisible){
  if(!feature || !feature.surfaceLocal || !lineEndLocal || feature.leaderBatchIndex === undefined){
    return;
  }

  feature.leaderVisible = isVisible !== false;
  feature.leaderStartLocal = feature.surfaceLocal.clone();
  feature.leaderEndLocal = feature.leaderVisible ? lineEndLocal.clone() : null;

  leaderLinesDirty = true;
}

function commitLeaderLineGeometry(){
  if(!leaderLinesDirty){
    return;
  }

  var outlinePositions = [];
  var corePositions = [];

  for(var i = 0; i < featureRecords.length; i++){
    var feature = featureRecords[i];
    if(!feature || !feature.leaderVisible || !feature.leaderStartLocal || !feature.leaderEndLocal){
      continue;
    }

    outlinePositions.push(
      feature.leaderStartLocal.x * 0.99,
      feature.leaderStartLocal.y * 0.99,
      feature.leaderStartLocal.z * 0.99,
      feature.leaderEndLocal.x,
      feature.leaderEndLocal.y,
      feature.leaderEndLocal.z
    );

    corePositions.push(
      feature.leaderStartLocal.x * 0.99,
      feature.leaderStartLocal.y * 0.99,
      feature.leaderStartLocal.z * 0.99,
      feature.leaderEndLocal.x,
      feature.leaderEndLocal.y,
      feature.leaderEndLocal.z
    );
  }

  if(leaderOutlineLine && leaderOutlineLine.geometry){
    if(outlinePositions.length > 0){
      leaderOutlineLine.geometry.setPositions(outlinePositions);
    }
    leaderOutlineLine.visible = outlinePositions.length > 0;
  }
  if(leaderCoreLine && leaderCoreLine.geometry){
    if(corePositions.length > 0){
      leaderCoreLine.geometry.setPositions(corePositions);
    }
    leaderCoreLine.visible = corePositions.length > 0;
  }
  if(leaderLinesGroup){
    leaderLinesGroup.visible = !!options.showLabelLeaders && outlinePositions.length > 0;
  }
  leaderLinesDirty = false;
}

function updateLeaderLinesOpacity(){
  if(leaderOutlineLine && leaderOutlineLine.material){
    leaderOutlineLine.material.opacity = options.labelOpacity * 0.5;
  }
  if(leaderCoreLine && leaderCoreLine.material){
    leaderCoreLine.material.opacity = options.labelOpacity;
  }
}

function updateLabelsInView(){
  if(!featureRecords || !options.showLabels || !options.showMoon){
    return;
  }

  globeCenterWorld.set(0, 0, 0).applyMatrix4(GlobeGroup.matrixWorld);
  var featureWorld = new THREE.Vector3();
  var featureNormal = new THREE.Vector3();
  var featureToCamera = new THREE.Vector3();
  var projected = new THREE.Vector3();
  var labelDirection = new THREE.Vector3();
  var labelPositionLocal = new THREE.Vector3();
  var lineEndLocal = new THREE.Vector3();
  var limbVisibilityEpsilon = 0.02;

  for(var i = 0; i < featureRecords.length; i++){
    var feature = featureRecords[i];
    if(!feature || !feature.labelSprite || !feature.positionLocal){
      continue;
    }

    featureWorld.copy(feature.positionLocal).applyMatrix4(GlobeGroup.matrixWorld);
    featureNormal.copy(featureWorld).sub(globeCenterWorld).normalize();
    featureToCamera.copy(camera.position).sub(featureWorld).normalize();

    // Per-feature horizon test avoids back-side bleed near limb at close zoom.
    if(featureNormal.dot(featureToCamera) <= limbVisibilityEpsilon){
      feature.labelSprite.visible = false;
      updateLeaderLineGeometry(feature, feature.positionLocal, false);
      continue;
    }

    projected.copy(featureWorld).project(camera);
    if(projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1){
      feature.labelSprite.visible = false;
      updateLeaderLineGeometry(feature, feature.positionLocal, false);
      continue;
    }

    feature.labelSprite.visible = true;
    feature.labelSprite.position.copy(feature.positionLocal);
    if(options.showLabelLeaders){
      var limbDistance = featureNormal.dot(featureToCamera);
      var limbFactor = Math.max(0, Math.min(1, (1 - limbDistance) / (1 - limbVisibilityEpsilon)));
      var leaderExtension = globe_radius * (0.02 + limbFactor * 0.08) * options.leaderLabelRadialOffset;

      labelDirection.copy(feature.positionLocal).normalize();
      labelPositionLocal.copy(feature.positionLocal).addScaledVector(labelDirection, leaderExtension);
      lineEndLocal.copy(labelPositionLocal);

      feature.labelSprite.position.copy(labelPositionLocal);
      updateLeaderLineGeometry(feature, lineEndLocal, true);
    } else {
      updateLeaderLineGeometry(feature, feature.positionLocal, false);
    }
  }

  updateLeaderLinesOpacity();
  if(leaderLinesGroup){
    leaderLinesGroup.visible = !!options.showLabelLeaders;
  }
  commitLeaderLineGeometry();
}

function getSurfaceDisplacementAtLatLon(lat, lon){
  var displacementBias = globeDisplacementBias;
  if(!displacementImageData || displacementImageWidth === 0 || displacementImageHeight === 0){
    return displacementBias;
  }

  var normalizedLon = ((lon % 360) + 360) % 360;
  var u = 0.5 - normalizedLon / 360;
  u = ((u % 1) + 1) % 1;
  var v = (90 - lat) / 180;
  v = Math.min(1, Math.max(0, v));

  var pixelX = Math.min(displacementImageWidth - 1, Math.max(0, Math.floor(u * (displacementImageWidth - 1))));
  var pixelY = Math.min(displacementImageHeight - 1, Math.max(0, Math.floor(v * (displacementImageHeight - 1))));
  var pixelIndex = (pixelY * displacementImageWidth + pixelX) * 4;

  var r = displacementImageData[pixelIndex];
  var g = displacementImageData[pixelIndex + 1];
  var b = displacementImageData[pixelIndex + 2];
  var displacementValue = (r + g + b) / (3 * 255);
  return displacementValue * options.displacementScale + displacementBias;
}

function initializeDisplacementSampler(mapFile){
  var imageLoader = new THREE.ImageLoader();
  imageLoader.load(
    mapFile,
    function(image){
      var samplerCanvas = document.createElement('canvas');
      samplerCanvas.width = image.width;
      samplerCanvas.height = image.height;
      var samplerContext = samplerCanvas.getContext('2d');
      samplerContext.drawImage(image, 0, 0);

      var imageData = samplerContext.getImageData(0, 0, image.width, image.height);
      displacementImageData = imageData.data;
      displacementImageWidth = image.width;
      displacementImageHeight = image.height;
      updateLabelsPosition();
    },
    undefined,
    function(error){
      console.log('failed to initialize displacement sampler');
      console.log(error);
    }
  );
}

function clearLabels(){
  disposeLeaderLinesBatch();

  for(var j = 0; j < featureRecords.length; j++){
    if(featureRecords[j]){
      featureRecords[j].labelSprite = null;
      featureRecords[j].leaderBatchIndex = undefined;
      featureRecords[j].leaderVisible = false;
      featureRecords[j].leaderStartLocal = null;
      featureRecords[j].leaderEndLocal = null;
      featureRecords[j].surfaceLocal = null;
      featureRecords[j].positionLocal = null;
    }
  }

  for(var i = PointsOfInterest.children.length - 1; i >= 0; i--){
    var child = PointsOfInterest.children[i];
    child.traverse(function(node){
      if(node.geometry){
        node.geometry.dispose();
      }
      if(node.material){
        if(node.material.map){
          node.material.map.dispose();
        }
        node.material.dispose();
      }
    });
    PointsOfInterest.remove(child);
  }
}

function refreshLabels(){
  if(craterCsvText || featuresCsvText || landingSitesCsvText){
    createLabels();
  }
}

function parseLatitude(latString){
  var value = parseFloat(latString);
  if(isNaN(value)){
    return NaN;
  }
  return latString.toUpperCase().indexOf('S') >= 0 ? -value : value;
}

function parseLongitude(lonString){
  var value = parseFloat(lonString);
  if(isNaN(value)){
    return NaN;
  }
  return lonString.toUpperCase().indexOf('W') >= 0 ? value : -value;
}

function latLonToGlobePoint(lat, lon, radius){
  return new THREE.Vector3(
    radius * Math.cos(-1 * lon * radsPerDeg) * Math.cos(lat * radsPerDeg),
    radius * Math.sin(-1 * lon * radsPerDeg) * Math.cos(lat * radsPerDeg),
    radius * Math.sin(lat * radsPerDeg)
  );
}

function createLabelSprite(labelText, featureDiameter, minDiameter, maxDiameter, sizeMultiplierOverride, textColorOverride){
  var canvasLabel = document.createElement('canvas');
  var context = canvasLabel.getContext('2d');
  var fontSize = options.labelFontSize;
  var padding = 20;

  context.font = fontSize + 'px Arial, sans-serif';
  var textWidth = Math.ceil(context.measureText(labelText).width);
  canvasLabel.width = textWidth + padding * 2;
  canvasLabel.height = fontSize + padding * 2;

  context = canvasLabel.getContext('2d');
  context.font = fontSize + 'px Arial, sans-serif';
  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  context.lineWidth = options.labelStrokeWidth;

  context.fillStyle = 'rgba(0, 0, 0, ' + options.labelBackgroundOpacity + ')';
  context.fillRect(0, 0, canvasLabel.width, canvasLabel.height);

  context.strokeStyle = options.labelStrokeColor;
  context.strokeText(labelText, padding, canvasLabel.height / 2);

  context.fillStyle = textColorOverride || options.labelTextColor;
  context.fillText(labelText, padding, canvasLabel.height / 2);

  var texture = new THREE.CanvasTexture(canvasLabel);
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  var material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: options.labelOpacity,
    depthTest: false,
    depthWrite: false,
  });

  var sprite = new THREE.Sprite(material);
  var diameterRange = maxDiameter - minDiameter;
  var normalizedDiameter = (featureDiameter === null || diameterRange <= 0) ? 0.5 : (featureDiameter - minDiameter) / diameterRange;
  var scaledDiameter = Math.pow(normalizedDiameter, 0.65);
  var sizeMultiplier = (typeof sizeMultiplierOverride === 'number') ? sizeMultiplierOverride : (0.5 + scaledDiameter);
  var labelHeight = globe_radius * options.labelScale * sizeMultiplier;
  var labelAspect = canvasLabel.width / canvasLabel.height;
  sprite.scale.set(labelHeight * labelAspect, labelHeight, 1);
  sprite.renderOrder = 10;
  return sprite;
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
  GlobeGroup.rotation.set(0, 0, 0); // re-center globe from prior manual rotations
  var cameraDistToOrigin = Math.sqrt( camera.position.x*camera.position.x + camera.position.y*camera.position.y + camera.position.z*camera.position.z);
  var normalizedLon = ((lon % 360) + 360) % 360;
  var cameraPos = latLonToGlobePoint(lat, normalizedLon, cameraDistToOrigin);

  console.log("setting camera position to lat " + lat + ", lon " + lon);
  camera.position.copy(cameraPos);
  controls.target.set(0, 0, 0);
  controls.update(); // force coord frames update before transfering sun to cam frame
  console.log(camera.position);
}

function placeSun(){
  console.log("setting sun position to lat " + options.subSunLat + ", lon " + options.subSunLon);
  scene.add(sun);
  var normalizedSunLon = ((options.subSunLon % 360) + 360) % 360;
  // Sun longitude input is opposite sign convention to feature/camera west-positive longitudes.
  var sunPos = latLonToGlobePoint(options.subSunLat, -normalizedSunLon, options.sunPlaneDist);
  sun.position.copy(sunPos);
  camera.attach(sun);
  console.log(fakeSun.position);
}

function changeMap(){
  var mapfile = 'data/' + options.mapFile;
  console.log("changing base map to: " + mapfile);
  globe.material.map = new THREE.TextureLoader().load(mapfile);
  globe.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
}

function forEachGlobeMaterial(callback){
  if(!globe || typeof globe.traverse !== 'function'){
    return;
  }

  globe.traverse(function(child){
    if(child && child.isMesh && child.material){
      var materials = Array.isArray(child.material) ? child.material : [child.material];
      for(var i = 0; i < materials.length; i++){
        callback(materials[i], child);
      }
    }
  });
}

function setGlobeMaterialProperty(propertyName, value){
  if(!globe){
    return;
  }

  forEachGlobeMaterial(function(material){
    if(propertyName in material){
      material[propertyName] = value;
      material.needsUpdate = true;
    }
  });
}


function setMirroring(boolMirror){
  if(boolMirror){
    controls.rotateSpeed = -1;
    controls.dynamicDampingFactor = -0.2;
    webglEl.style.transform = "scaleX(-1)";
  } else {
    controls.rotateSpeed = 1;
    controls.dynamicDampingFactor = 0.2;
    webglEl.style.transform = "scaleX(1)";
  }
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


function createGlobe(radius, segments) {
  console.log("making globe");
  const geometry = new THREE.SphereGeometry(radius, segments, segments);
  const material = new THREE.MeshPhongMaterial({
    shininess:  options.shininess,
    bumpScale:  options.bumpScale,
    side:       THREE.DoubleSide,
  });
  globe = new THREE.Mesh(geometry, material);
  globe.rotateX(Math.PI/2);  // reorient to z-up
  globe.rotation.z = options.rotation;
  GlobeGroup.add(globe);
  globeLoaded = true;

  // Load elevation model:  
  const bumpMapFile = 'data/lola_dem_4k.jpg';
  console.log("loading bump map " + bumpMapFile);
  globe.material.bumpMap = new THREE.TextureLoader().load(bumpMapFile);
  globe.material.bumpMap.minFilter = THREE.LinearMipMapLinearFilter;
  globe.material.bumpMap.magFilter = THREE.LinearFilter;
  globe.material.bumpMap.anisotropy = 0;
  globe.material.generateMipmaps = false;

  globe.material.displacementMap = new THREE.TextureLoader().load(bumpMapFile);
  globe.material.displacementScale = options.displacementScale;
  globe.material.displacementBias = -0.01;
  initializeDisplacementSampler(bumpMapFile);

  // Load base map
  changeMap();
  //console.log(globe);
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

