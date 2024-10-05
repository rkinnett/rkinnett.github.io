

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';

import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';


let camera, scene, renderer, astronaut, spacecraft;
//let cubeRenderTarget, cubeCamera, 
let visor_material;
let controllers;
let controllerGrip = [];
let mmu;
let skybox;
let infoPanel = {};
let infoText = [];
let vr_camera;

  
window.THREE = THREE;

const clock = new THREE.Clock();

scene = new THREE.Scene();
scene.background = 0x000000;

camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 20000 );
scene.add( camera );

camera.position.set(4, 0.75, -2);
camera.lookAt( 0, 0, -10);



renderer = new THREE.WebGLRenderer( {antialias: true} );
renderer.autoClear = false;
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.xr.enabled = true;
renderer.xr.setFramebufferScaleFactor( 2.0 ); //double xr resolution default is 1

const container = document.getElementById('webgl');
container.appendChild( renderer.domElement );
document.body.appendChild( VRButton.createButton( renderer ) );


vr_camera = renderer.xr.getCamera();
vr_camera.near = 0.01;
vr_camera.far = 10000;
window.vr_camera = vr_camera;



window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const controls = new OrbitControls(camera, renderer.domElement)


infoPanel.geometry = new THREE.PlaneGeometry( 2, 2 );
infoPanel.name = "infoPanel";
infoPanel.canvas = document.createElement("canvas");
infoPanel.canvas.width = 600;
infoPanel.canvas.height = 600;
infoPanel.ctx = infoPanel.canvas.getContext("2d");
infoPanel.lineheight = 15;
infoPanel.ctx.font = "" + infoPanel.lineheight + "px monospace";
infoPanel.texture = new THREE.CanvasTexture(infoPanel.canvas);
infoPanel.material = new THREE.MeshBasicMaterial( { map: infoPanel.texture, transparent: true } );
infoPanel.panel = new THREE.Mesh( infoPanel.geometry, infoPanel.material );
infoPanel.panel.name = "info_panel";
infoPanel.panel.position.set(0, 1.5, -3);
infoPanel.panel.rotation.x = 1;
infoPanel.panel.scale.setScalar( 2 );
infoPanel.panel.material.opacity = 0.25;
infoPanel.material.visible = false;

infoPanel.write = function(txt){
  infoPanel.ctx.clearRect(0, 0, infoPanel.canvas.width, infoPanel.canvas.height);  // Clear
  infoPanel.ctx.fillStyle = "white";  // font color
  var lines = txt.split('\n');
  for(const line of lines) {
    infoText.push(line);
    if(infoText.length>20) infoText.shift(infoText.length-20);
  }
  for(var j=0; j<infoText.length; j++){
    infoPanel.ctx.fillText( (infoText[j]||''), 10, 30 + (j*infoPanel.lineheight) );
  }
  infoPanel.texture.needsUpdate = true;
};
window.infoPanel = infoPanel;

infoPanel.write("Welcome to Jezero Crater, Mars!\n");
infoPanel.write("Explore the remnants of the ancient Jezero river delta with\nNASA's Perseverance rover.\n");




// Add lights to the scene
const ambientLight = new THREE.AmbientLight(0xffffff);
ambientLight.intensity = 0.05;
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 5, 1);
pointLight.position.set(10, 100, -200); // Set the position of the light
pointLight.intensity = 0.1;
scene.add(pointLight);

const pointLight2 = new THREE.PointLight(0xffffff, 5, 1);
pointLight2.position.set(1, 100, -1); // Set the position of the light
pointLight2.intensity = 0.1;
scene.add(pointLight2);

const pointLight3 = new THREE.PointLight(0xffffff, 5, 1);
pointLight3.position.set(-100, 100, 1); // Set the position of the light
pointLight3.intensity = 0.1;
scene.add(pointLight3);




const sun = new THREE.DirectionalLight(0xffffff);
sun.name = "sun";
sun.position.set(20, 20, 2000);
sun.intensity = 1;
sun.castShadow = true;
sun.shadow.mapSize = new THREE.Vector2(4096, 2048);
sun.shadow.camera.near = sun.position.z - 50;
sun.shadow.camera.far = sun.position.z + 50;
sun.shadow.camera.top = 15;
sun.shadow.camera.bottom = -15;
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
window.sun = sun;
//renderer.shadowMap.type = THREE.VSMShadowMap
scene.add(sun);
//scene.add(new THREE.CameraHelper(sun.shadow.camera))


const loading_manager = new THREE.LoadingManager();
loading_manager.onStart = function ( url, itemsLoaded, itemsTotal ) {
	console.log( 'Started loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.' );
};
loading_manager.onLoad = function ( ) {
	console.log( 'Loading complete!');
  
  load_spacecraft();
  
};
window.loading_manager = loading_manager;
loading_manager.onProgress = function ( url, itemsLoaded, itemsTotal ) {
	console.log( 'Loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.' );
};


const textureLoader = new THREE.TextureLoader(loading_manager);



const skybox_geometry = new THREE.BoxGeometry(12000,12000,12000);
textureLoader.setPath( 'assets/background/2k/' );
let skybox_materials = [
    new THREE.MeshBasicMaterial( { map: textureLoader.load("px.png"), side:THREE.DoubleSide, color: 0xaaaaaa } ),
    new THREE.MeshBasicMaterial( { map: textureLoader.load("nx.png"), side:THREE.DoubleSide, color: 0xaaaaaa } ),
    new THREE.MeshBasicMaterial( { map: textureLoader.load("py.png"), side:THREE.DoubleSide, color: 0xaaaaaa } ),
    new THREE.MeshBasicMaterial( { map: textureLoader.load("ny.png"), side:THREE.DoubleSide, color: 0xaaaaaa } ),
    new THREE.MeshBasicMaterial( { map: textureLoader.load("pz.png"), side:THREE.DoubleSide, color: 0xaaaaaa } ),
    new THREE.MeshBasicMaterial( { map: textureLoader.load("nz.png"), side:THREE.DoubleSide, color: 0xaaaaaa } ),
];

skybox = new THREE.Mesh( skybox_geometry, skybox_materials );
skybox.name = "stars";
skybox.scale.x = -1;
skybox.rotation.set(0,0,0,'XYZ');
scene.add(skybox);
window.skybox = skybox;


const gltf_loader = new GLTFLoader();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath( 'three/examples/jsm/libs/draco/' );
gltf_loader.setDRACOLoader( dracoLoader );


/*
cubeRenderTarget = new THREE.WebGLCubeRenderTarget( 512 );
cubeRenderTarget.texture.type = THREE.HalfFloatType;
cubeCamera = new THREE.CubeCamera( 1, 1000, cubeRenderTarget );
cubeCamera.up.set(0, 1, 0);
window.cubeCamera = cubeCamera;
console.log('cubeCamera:', cubeCamera);
*/


visor_material = new THREE.MeshStandardMaterial( {
  envMap: scene.environment,
  roughness: 0.02,
  metalness: 1,
  color: 0xffeeaa,
} );




let europa;

gltf_loader.load(
  './assets/models/Europa_1_3138.glb',
  function (gltf) {
    europa = gltf.scene.children[0];
    europa.name = "europa";
    europa.position.set(150,-200,-1800);
    europa.geometry.scale(1.5,1.5,1.5);
    europa.material.color.set(0.2,0.2,0.2);
    europa.rotation.y = -3;
    scene.add(europa);
    window.europa = europa;
  },
  function ( xhr ) {
    //console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
  },
  function ( error ) {
    console.log( 'An error happened loading the europa model' );
    console.log(error);
  }
)


let jupiter;

gltf_loader.load(
  './assets/models/Jupiter_1_142984.glb',
  function (gltf) {
    jupiter = gltf.scene.children[0];
    jupiter.name = "jupiter";
    jupiter.geometry.scale(8,8,8);
    jupiter.rotation.set(0,1,0);
    jupiter.position.set(1200,10,-6000);
    jupiter.material.color.set(0.2,0.2,0.2);
    scene.add(jupiter);
    window.jupiter = jupiter;
  },
  function ( xhr ) {
    //console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
  },
  function ( error ) {
    console.log( 'An error happened loading the jupiter model' );
    console.log(error);
  }
)



function load_spacecraft(){
  gltf_loader.load(
    './assets/models/europa_clipper.glb',
    function (gltf) {
      spacecraft = gltf.scene.children[0];
      spacecraft.name = "spacecraft";
      
      spacecraft.traverse((child) => {
        if ( child.isMesh ) {
          child.receiveShadow = true;          
          if ( ['solar_cells',].includes(child.name) ){
            child.castShadow = true;
          }
        }
      });
      
      console.log(spacecraft)
      scene.add(spacecraft);
      spacecraft.solar_array = spacecraft.children[10];
      spacecraft.position.set(0,0,-8);
      spacecraft.rotation.set(-1.571,0,0,'XYZ');
      window.spacecraft = spacecraft;
      
      skybox.material.forEach(function(material){material.color.set(0xffffff)});
      scene.environment = new THREE.PMREMGenerator(renderer).fromScene(scene, 0, 0.1, 20000).texture;
      skybox.material.forEach(function(material){material.color.set(0xaaaaaa)});

      sun.target.position.copy( spacecraft.position );

      load_astronaut();
    },
    function ( xhr ) {
      //console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
    },
    function ( error ) {
      console.log( 'An error happened loading the spacecraft model' );
    }
  );
}



const vr_pov_container = new THREE.Group();
vr_pov_container.name = "pov_container";
vr_pov_container.add( vr_camera );
vr_pov_container.add( infoPanel.panel );


astronaut = new THREE.Group();
astronaut.name = "astronaut";
astronaut.add( vr_pov_container );
scene.add(astronaut);







textureLoader.setPath( 'assets/lensflare/' );
const textureFlare0 = textureLoader.load( "flare0.png" );
const textureFlare1 = textureLoader.load( "flare1.png" );
const textureFlare2 = textureLoader.load( "flare2.png" );
const textureFlare3 = textureLoader.load( "flare3.png" );
const lensflare = new Lensflare();

lensflare.addElement( new LensflareElement( textureFlare0, 160, 0 ) );
lensflare.addElement( new LensflareElement( textureFlare3, 500, 0.02 ) );
lensflare.addElement( new LensflareElement( textureFlare0, 200,  0 ) );
lensflare.addElement( new LensflareElement( textureFlare3, 140,  0.05 ) );
lensflare.addElement( new LensflareElement( textureFlare3, 240, 0.55 ) );
lensflare.addElement( new LensflareElement( textureFlare3, 360, 0.65 ) );
lensflare.addElement( new LensflareElement( textureFlare3, 240, 0.75 ) );
sun.add( lensflare );



function load_astronaut(){

  // Load the astronaut
  gltf_loader.load(
    './assets/models/astronaut.glb',
    function (gltf) {
      const astronaut_model = gltf.scene.children[0];
      console.log(astronaut_model)
      scene.add(astronaut_model);  // add directly to scene, not environment, since this will be static relative to viewer
      console.log("astronaut_model:",astronaut_model);
      astronaut_model.position.set(0, 0, 0.25);
      //astronaut_model.position.set(0, 0, 0.25);
      astronaut_model.rotation.set(-1.571,0,1.571, 'XYZ');
      astronaut.add(astronaut_model)
      //astronaut.rotation.set(0,0,-1.571,'XYZ');
      //spacecraft.solar_array = spacecraft.children[0].children[10].rotation.set(0,0,0)
      
      astronaut_model.traverse((child) => {
        if ( ! child.isMesh ) return;
        child.castShadow = true;
        child.receiveShadow = true;
        child.material.envMap = scene.environment;          
        if( child.name == "visor"){
          //console.log('setting visor');
          astronaut_model.visor = child;
          astronaut_model.visor.material = visor_material;
          //astronaut_model.visor.material.envMap = scene.environment;
        } else {
          //child.material.roughness = 0.8;
          //child.material.metalness = 0.2;
        }      
        //THREE.MeshBasicMaterial.prototype.copy.call( child.material, prevMaterial );
      });
      astronaut.loaded = true;
      window.astronaut = astronaut;
            
    },
    function ( error ) {
      console.log( 'An error happened' );
    }
  );
}

const axes_astronaut_body_frame = new THREE.AxesHelper( 1 );
//astronaut.add( axes_astronaut_body_frame );


const axes_astronaut_world_frame = new THREE.AxesHelper( 1 );
//scene.add( axes_astronaut_world_frame );



astronaut.q_angular_rate = new THREE.Quaternion();
astronaut.linear_rate = new THREE.Vector3();

astronaut.body_vectors = {
  x: new THREE.Vector3(1,0,0),
  y: new THREE.Vector3(0,1,0),
  z: new THREE.Vector3(0,0,1),
}

const line_colors = {x: 0xff0000, y: 0x00ff00, z: 0x0000ff };
['x','y','z'].forEach(function(axis){
  const unit_vec_geometry = new THREE.BufferGeometry();
  unit_vec_geometry.setFromPoints( [ new THREE.Vector3( 0, 0, 0 ), astronaut.body_vectors[axis] ] );
  const unit_vec_material = new THREE.LineBasicMaterial( { color: line_colors[axis] } );
  //scene.add( new THREE.Line(unit_vec_geometry, unit_vec_material) );
});



controllers = {
  // ROTATION
  right: {
    controller:  renderer.xr.getController(1),
    connected: false,
    grip:  renderer.xr.getControllerGrip(1),
    joystick: {
      axes: null,
      left_right: { 
        controller_axis_idx: 3,  
        val: {latest: 0, previous: 0},
        control_axis: 'x',
      },
      up_down: {
        controller_axis_idx: 2,  
        val: {latest: 0, previous: 0},
        control_axis: 'y',
      },      
    },    
  },
  // TRANSLATION
  left: {
    controller:  renderer.xr.getController(0),  
    connected: false,
    grip:  renderer.xr.getControllerGrip(0),
    joystick: {
      axes: null,
      left_right: { 
        controller_axis_idx: 3,  
        val: {latest: 0, previous: 0},  
        control_axis: 'z', 
      },
      up_down:    { 
        controller_axis_idx: 2,  
        val: {latest: 0, previous: 0},  
        control_axis: 'x', 
      },
    },
  }
};
  

const axes_world = new THREE.AxesHelper( 50 );
//scene.add( axes_world );

const control_vector_body_frame = new THREE.Vector3();
const control_vector_world_frame = new THREE.Vector3();
const control_vector_world_frame_arrow = new THREE.ArrowHelper( 
  new THREE.Vector3().copy( astronaut.position ), 
  new THREE.Vector3().copy( control_vector_world_frame ), 
  1, 0xffff00
);
control_vector_world_frame_arrow.origin = astronaut.position;
//scene.add( control_vector_world_frame_arrow ); 


renderer.xr.addEventListener('sessionstart', start_vr);

function start_vr(){
  console.log('Started VR session');
  infoPanel.write('Started VR session');
  
  const vr_head_height = renderer.xr.getCamera(camera).position.y;    
  vr_pov_container.position.set(0, -0.65, -0.1);
  //infoPanel.material.visible = true;
  console.log('vr head height', vr_head_height);
  infoPanel.write('vr camera position: ' + renderer.xr.getCamera(camera).position.x + ', ' + renderer.xr.getCamera(camera).position.y + ', ' + renderer.xr.getCamera(camera).position.z);
  infoPanel.write('vr head height: ' + vr_head_height);
  
  camera.removeFromParent();
  vr_pov_container.add( camera );
  vr_pov_container.add( vr_camera );
}



function update_mmu_attitude_and_position(dt){
  astronaut.quaternion.multiply( astronaut.q_angular_rate );
  astronaut.position.add( new THREE.Vector3().copy(astronaut.linear_rate).multiplyScalar(dt) );  
  axes_astronaut_world_frame.position.copy( astronaut.position );
}

const controller_vectors_geometry = new THREE.BufferGeometry();
controller_vectors_geometry.setFromPoints( [ new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, - 5 ) ] );

const controllerModelFactory = new XRControllerModelFactory();

const q_zero_rate = new THREE.Quaternion();


/*
function fire_thrusters(controller_hand, control_body_vector, value){
  console.log('fire_thrusters', controller_hand, controller_axis, value);
  const controller = controllers[controller_hand];
  control_vector_body_frame.copy( control_body_vector ).multiplyScalar(value);
  control_vector_world_frame.copy( control_vector_body_frame ).applyQuaternion( astronaut.quaternion );
  console.log('control_vector_body_frame',control_vector_body_frame);
  
  control_vector_world_frame_arrow.setDirection( control_vector_world_frame.clone().normalize() );
  control_vector_world_frame_arrow.position.copy( astronaut.position );
  
  
  console.log('control_vector_world_frame',control_vector_world_frame);
  if (controller_hand == "right"){
    // attitude input
    const q_rate_increment = new THREE.Quaternion().setFromAxisAngle( control_vector_body_frame.normalize(), control_increment ).normalize();
    astronaut.q_angular_rate.multiply( q_rate_increment ).normalize();
    
    console.log('astronaut.q_angular_rate', astronaut.q_angular_rate);
    console.log('Math.abs(astronaut.q_angular_rate.w)', Math.abs(astronaut.q_angular_rate.w));
    if ( Math.abs(astronaut.q_angular_rate.w)>0.999999998 ){
      console.log('zeroing angular rate');
      astronaut.q_angular_rate.copy( q_zero_rate );
      console.log('astronaut.q_angular_rate', astronaut.q_angular_rate);      
    };
    
    
  } else {
    // translation input    
    console.log('astronaut.linear_rate', astronaut.linear_rate);
    
    console.log(control_vector_world_frame.multiplyScalar( control_increment ));
    astronaut.linear_rate.add( control_vector_world_frame.multiplyScalar( control_increment ) );
    console.log('astronaut.linear_rate', astronaut.linear_rate);
  }
}
*/

const control_increments = {
  'translation': {
    'x':  0.05,
    'y':  0.05,
    'z':  0.05,
  },
  'rotation': {
    'x': -0.001,
    'y': -0.001,
    'z': -0.001,
  }
}



function fire_thrusters( motion_type, control_axis, control_value ){
  const control_increment = control_increments[motion_type][control_axis] * control_value;
  console.log('control_increment',control_increment);
  control_vector_body_frame.copy( astronaut.body_vectors[control_axis] );
  console.log('control_vector_body_frame',control_vector_body_frame);  
  control_vector_world_frame.copy( control_vector_body_frame ).applyQuaternion( astronaut.quaternion );
  console.log('control_vector_world_frame',control_vector_world_frame);
  
  control_vector_world_frame_arrow.setDirection( control_vector_world_frame.clone().normalize() );
  control_vector_world_frame_arrow.position.copy( astronaut.position );
  
  // TRANSLATIONAL MOTION
  if( motion_type == "translation" ){
    console.log('astronaut.linear_rate', astronaut.linear_rate);
    console.log(control_vector_world_frame.multiplyScalar( control_increment ));
    astronaut.linear_rate.add( control_vector_world_frame );
    console.log('astronaut.linear_rate', astronaut.linear_rate);
  } else {  
  
  // ROTATIONAL MOTION
    const q_rate_increment = new THREE.Quaternion().setFromAxisAngle( control_vector_body_frame.normalize(), control_increment ).normalize();
    console.log('q_rate_increment',q_rate_increment);
    astronaut.q_angular_rate.multiply( q_rate_increment ).normalize();
    
    console.log('astronaut.q_angular_rate', astronaut.q_angular_rate);
    console.log('Math.abs(astronaut.q_angular_rate.w)', Math.abs(astronaut.q_angular_rate.w));
    if ( Math.abs(astronaut.q_angular_rate.w)>0.999999998 ){
      console.log('zeroing angular rate');
      astronaut.q_angular_rate.copy( q_zero_rate );
      console.log('astronaut.q_angular_rate', astronaut.q_angular_rate);      
    };
  }
}



window.fire_thrusters = fire_thrusters;




['left', 'right'].forEach(function(controller_hand){
  const controller = controllers[controller_hand].controller;
  //controller.add( new THREE.Line( controller_vectors_geometry ) );
  controller.addEventListener( 'connected', (e) => {
    console.log(controller_hand + ' controller connected');
    infoPanel.write(controller_hand + ' controller connected');
    controller.gamepad = e.data.gamepad;
    controller.buttonState = controller.gamepad.buttons.map(function(btn) { return btn.value; });  //get initial vals
    controller.axesState   = controller.gamepad.axes.map(function(axs) { return axs.value; });  //get initial vals
    vr_pov_container.add( controller );
                
    controllers[controller_hand].joystick.axes = controller.gamepad.axes;
    infoPanel.write('gamepad axes:  ' + controllers[controller_hand].joystick.axes);
    controllers[controller_hand].connected = true;
  });
  
  const grip = controllers[controller_hand].grip;
  grip.add( controllerModelFactory.createControllerModel( grip ) );
  vr_pov_container.add( grip );
});

function controllerEvent(e, controller_hand){
  //const infoTxt = "controller " + controller_hand + " event: " + e.type /*+ '\n' + JSON.stringify(e, null, '\t')*/;
  //infoPanel.write(infoTxt);
  console.log("controller event: " + e.type);
  console.log(e);
}



function checkController(controller_hand){
  const controller = controllers[controller_hand].controller;
  if(controller.buttonState){
    controller.prevButtonsState = controller.buttonState.slice();
    controller.buttonState = controller.gamepad.buttons.map(function(btn) { return btn.value; });
    //console.log(controller.buttonState);
    for(var button_idx=0; button_idx<controller.gamepad.buttons.length; button_idx++){
      //buttonsVals += controller.buttonState[button_idx].value + "(" + controller.prevButtonsState[button_idx].value + ") ";
      const button_val_rounded = Math.round( controller.buttonState[button_idx]*0.8 );
      if(controller.buttonState[button_idx] != controller.prevButtonsState[button_idx]){
        console.log( controller_hand + " controller button " + button_idx + " state changed to " + button_val_rounded);
        infoPanel.write(controller_hand + " controller button " + button_idx + " state changed to " + button_val_rounded);
        if( button_val_rounded == 1 ){
          button_pressed( controller_hand, button_idx );
        }
      }
    }
    controller.prevAxesState = controller.axesState;
    controller.axesState = controller.gamepad.axes.map(function(val){return Math.round(val*0.8)})
    //console.log('axes', controller.axesState, 'prev', controller.prevAxesState);
    //console.log(controller.buttonState);
    for(var idxAxis=0; idxAxis<controller.gamepad.axes.length; idxAxis++){
      const axis_val = controller.axesState[idxAxis];
      //buttonsVals += controller.buttonState[idxAxis].value + "(" + controller.prevAxesState[idxAxis].value + ") ";
      if(axis_val != controller.prevAxesState[idxAxis]){
        console.log( controller_hand + " controller axis " + idxAxis + " state changed to " + axis_val);
        infoPanel.write(controller_hand + " controller axis " + idxAxis + " state changed to " + axis_val);
        // do things on button release:
        if(axis_val==1 || axis_val==-1){
          infoPanel.write( "idxAxis", idxAxis);
          console.log('idxAxis', idxAxis);
          const axis_dir = idxAxis==2 ? 'up_down' : 'left_right';
          console.log(controllers[controller_hand].joystick[axis_dir]);
          const control_axis = controllers[controller_hand].joystick[axis_dir].control_axis;
          const motion_type = controller_hand=="left" ? "translation" : "rotation";
          fire_thrusters( motion_type, control_axis, axis_val );
        }
      }
    }  
  }
}


function button_pressed( controller_hand, button_idx ) {
  switch( controller_hand) {
    // TRANSLATION
    case "left":   
      switch( button_idx ){
        case 0:    // trigger 
          fire_thrusters( 'translation', 'y', 1 );
          break;
        case 1:   // middle finger button
          fire_thrusters( 'translation', 'y', -1 );
          break;
        case 3:
          astronaut.linear_rate.set(0,0,0);
          break;
        default:
          console.log('unmapped button: ' + controller_hand + ' controller button ' + button_idx );
          infoPanel.write('unmapped button: ' + controller_hand + ' controller button ' + button_idx );
      }
      break;
    // ROTATION
    case "right":  
      switch( button_idx ){
        case 3:   // hat
          astronaut.q_angular_rate.copy( q_zero_rate );
          break;
        case 4:
        case 5:
          infoPanel.material.visible = ! infoPanel.material.visible;
          break;
        default:
          console.log('unmapped button: ' + controller_hand + ' controller button ' + button_idx );
          infoPanel.write('unmapped button: ' + controller_hand + ' controller button ' + button_idx );
      }
      break;
  }
}



renderer.setAnimationLoop( function () {
  const dt = clock.getDelta();  
  //update_mmu_controls();

  checkController('left');
  checkController('right');
  update_mmu_attitude_and_position(dt);

	renderer.render( scene, camera );
  
});



function update() {
  controls.update();
}


function animate()  {
  requestAnimationFrame(animate);
	render();		
	update();
}


function render() 
{
	renderer.render( scene, camera );
}


//animate();


window.controllers = controllers;
window.scene = scene;
window.camera = camera;
window.renderer = renderer;
window.mmu = mmu;
