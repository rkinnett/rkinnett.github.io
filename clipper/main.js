

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';

import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';



let camera, scene, renderer, astronaut, spacecraft, environment;
let cubeRenderTarget, cubeCamera, reflectiveMaterial;
let controllers;
let controllerGrip = [];
let mmu;
let skybox;

window.THREE = THREE;


const clock = new THREE.Clock();


scene = new THREE.Scene();
scene.background = 0x000000;

camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 2000 );
//camera.up.set(0,1,0);

renderer = new THREE.WebGLRenderer();
renderer.autoClear = false;
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.antialis = true;
renderer.xr.enabled = true;
document.getElementById('webgl').appendChild( renderer.domElement );

document.body.appendChild( VRButton.createButton( renderer ) );


window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

/*
scene.background = new THREE.CubeTextureLoader()
	.setPath( 'assets/background/2k/' )
	.load( ['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png' ]);
*/  

const controls = new OrbitControls(camera, renderer.domElement)


environment = new THREE.Group();
scene.add(environment);


// Add lights to the scene
const ambientLight = new THREE.AmbientLight(0xffffff);
ambientLight.intensity = 0.2;
environment.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 5, 1);
pointLight.position.set(10, 100, 20); // Set the position of the light
pointLight.intensity = 20;
environment.add(pointLight);


const sun = new THREE.DirectionalLight(0xffffff);
sun.position.set(100, 100, 1000);
sun.intensity = 4;
sun.castShadow = true; // default false
sun.shadow.mapSize.width = 512; // default
sun.shadow.mapSize.height = 512; // default
sun.shadow.camera.near = 0.1; // default
sun.shadow.camera.far = 1200; // default
environment.add(sun);
//scene.add(sun);


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



camera.position.set(15,-4,-1.5);


/*
const texture_cube = new THREE.CubeTextureLoader()
	.setPath( 'assets/background/2k/' )
	.load( ['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png' ]);

const skybox_geom = new THREE.BoxGeometry(3, 3, 3);
const skybox = new THREE.Mesh(skybox_geom, texture_cube);
scene.add(skybox);
*/

const skybox_geometry = new THREE.BoxGeometry(2000,2000,2000);
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
skybox.scale.x = -1;
skybox.rotation.set(0,0,0,'XYZ');
environment.add(skybox);
window.skybox = skybox;


const gltf_loader = new GLTFLoader();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath( 'three/examples/jsm/libs/draco/' );
gltf_loader.setDRACOLoader( dracoLoader );


cubeRenderTarget = new THREE.WebGLCubeRenderTarget( 512 );
cubeRenderTarget.texture.type = THREE.HalfFloatType;
cubeCamera = new THREE.CubeCamera( 1, 1000, cubeRenderTarget );
cubeCamera.up.set(0, 1, 0);
window.cubeCamera = cubeCamera;

reflectiveMaterial = new THREE.MeshStandardMaterial( {
  //envMap: cubeRenderTarget.texture,
  envMap: scene.environment,
  roughness: 0.02,
  metalness: 1,
  //shininess: 1,
  color: 0xffcc88,
} );

console.log('cubeCamera:', cubeCamera);





function load_spacecraft(){
  gltf_loader.load(
    './assets/models/europa_clipper.glb',
    function (gltf) {
      spacecraft = gltf.scene.children[0];
      console.log(spacecraft)
      environment.add(spacecraft);
      spacecraft.solar_array = spacecraft.children[10].rotation.set(0,0,0);
      spacecraft.position.set(0,0,-8);
      spacecraft.rotation.set(-1.571,0,0,'XYZ');
      window.spacecraft = spacecraft;
      
      skybox.material.forEach(function(material){material.color.set(0xffffff)});
      scene.environment = new THREE.PMREMGenerator(renderer).fromScene(scene, 0, 0.1, 2500).texture;
      skybox.material.forEach(function(material){material.color.set(0xaaaaaa)});

      load_astronaut();
    },
    function ( xhr ) {
      //console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
    },
    function ( error ) {
      console.log( 'An error happened' );
    }
  );
}

astronaut = new THREE.Group();
astronaut.add( camera );
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
      //astronaut_model.position.set(0, 1.25, 0.25);
      //astronaut_model.position.set(0, 0, 0.25);
      astronaut_model.rotation.set(-1.571,0,1.571, 'XYZ');
      astronaut.add(astronaut_model)
      //astronaut.rotation.set(0,0,-1.571,'XYZ');
      //spacecraft.solar_array = spacecraft.children[0].children[10].rotation.set(0,0,0)
      
      astronaut_model.traverse((child) => {
        if ( ! child.isMesh ) return;
        //var prevMaterial = child.material;
        //child.material = new THREE.MeshPhongMaterial();
        child.material.shininess = 1;
        //child.material.envMap = cubeCamera.renderTarget.texture;
        if( child.name == "visor"){
          console.log('setting visor');
          astronaut_model.visor = child;
          astronaut_model.visor.material = reflectiveMaterial;
          //cubeCamera.position.copy(astronaut_model.visor.position);
          //astronaut_model.visor.material.envMap = cubeRenderTarget.texture;
          astronaut_model.visor.material.envMap = scene.environment;

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


camera.lookAt(0,1.5,0);

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
  left: {
    controller:  renderer.xr.getController(1),
    grip:  renderer.xr.getControllerGrip(1),
    joystick: {
      axes: null,
      left_right: { 
        controller_axis_idx: 3,  
        val: {latest: 0, previous: 0},
        control_body_axis: astronaut.body_vectors.z,
        control_increment: 0.2,
      },
      up_down: {
        controller_axis_idx: 2,  
        val: {latest: 0, previous: 0},
        control_body_axis: astronaut.body_vectors.x,
        control_increment: -0.2,
      },
    },
    connected: false,
  },
  right: {
    controller:  renderer.xr.getController(0),  
    grip:  renderer.xr.getControllerGrip(0),
    joystick: {
      axes: null,
      left_right: { 
        controller_axis_idx: 3,  
        val: {latest: 0, previous: 0},  
        control_body_axis: astronaut.body_vectors.x, 
        control_increment: -0.0005 
      },
      up_down:    { 
        controller_axis_idx: 2,  
        val: {latest: 0, previous: 0},  
        control_body_axis: astronaut.body_vectors.y, 
        control_increment: -0.0005 
      },
    },
    connected: false,
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
control_vector_world_frame_arrow.origin = astronaut.position
//scene.add( control_vector_world_frame_arrow ); 


function update_mmu_attitude_and_position(dt){
  astronaut.quaternion.multiply( astronaut.q_angular_rate );
  astronaut.position.add( new THREE.Vector3().copy(astronaut.linear_rate).multiplyScalar(dt) );
  //astronaut.position.x += mmu.rate.x * 0.01*dt*-1;
  //astronaut.position.y += mmu.rate.y * 0.01*dt;
  //astronaut.position.z += mmu.rate.z * 0.01*dt;
  
  
  axes_astronaut_world_frame.position.copy( astronaut.position );
}

const controller_vectors_geometry = new THREE.BufferGeometry();
controller_vectors_geometry.setFromPoints( [ new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, - 5 ) ] );

const controllerModelFactory = new XRControllerModelFactory();

const q_zero_rate = new THREE.Quaternion();

function update_mmu_controls() {
  ['left', 'right'].forEach(function(controller_side){
    if (controllers[controller_side].connected){
      const controller = controllers[controller_side];
      ['left_right', 'up_down'].forEach(function(axis){
        controller.joystick[axis].val.previous = controller.joystick[axis].val.current;
        const controller_axis_idx = controller.joystick[axis].controller_axis_idx;
        const current_input_value = controller.joystick.axes[controller_axis_idx] ;
        controller.joystick[axis].val.current = Math.round( current_input_value );
        if (controller.joystick[axis].val.current!=0 && controller.joystick[axis].val.previous==0  ){
          console.log(controller_side + ' controller thumbstick ' + axis + ' axis pressed ' + controller.joystick[axis].val.current);
          mmu_fire_thrusters(controller_side, axis, controller.joystick[axis].val.current);
        }
      });
    }
  });  
}


function mmu_fire_thrusters(controller_side, axis, value){
  console.log(controller_side, axis, value);
  const controller = controllers[controller_side];
  control_vector_body_frame.copy( controller.joystick[axis].control_body_axis ).multiplyScalar(value);
  const control_increment = controller.joystick[axis].control_increment;
  control_vector_world_frame.copy( control_vector_body_frame ).applyQuaternion( astronaut.quaternion );
  console.log('control_vector_body_frame',control_vector_body_frame);
  
  control_vector_world_frame_arrow.setDirection( control_vector_world_frame.clone().normalize() );
  control_vector_world_frame_arrow.position.copy( astronaut.position );
  
  
  console.log('control_vector_world_frame',control_vector_world_frame);
  if (controller_side == "right"){
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

window.fire_thrusters = mmu_fire_thrusters;




['left', 'right'].forEach(function(controller_side){
  const controller = controllers[controller_side].controller;
  controller.add( new THREE.Line( controller_vectors_geometry ) );
  controller.addEventListener( 'connected', (e) => {
    console.log(controller_side + ' controller connected');
    controller.gamepad = e.data.gamepad;
    controller.buttonState = controller.gamepad.buttons.map(function(btn) { return btn.value; });
    astronaut.add( controller );

    console.log('adding event listenders for ' + controller_side + ' controller');
    ['pressed', 'released', 'axis-pressed', 'axis-released', 'selectstart', 'selectend', 'squeezestart', 'squeezeend'].forEach(function(input_action){
      controller.addEventListener( input_action, function(e){controllerEvent(e, controller_side)} );
    });
    
    controllers[controller_side].joystick.axes = controller.gamepad.axes;
    controllers[controller_side].connected = true;
  });
  
  const grip = controllers[controller_side].grip;
  grip.add( controllerModelFactory.createControllerModel( grip ) );
  astronaut.add( grip );
});

function controllerEvent(e, controller_side){
  //const infoTxt = "controller " + controller_side + " event: " + e.type /*+ '\n' + JSON.stringify(e, null, '\t')*/;
  //infoPanel.write(infoTxt);
  console.log("controller event: " + e.type);
  console.log(e);
}



renderer.setAnimationLoop( function () {
  const dt = clock.getDelta();  
  update_mmu_controls();
  update_mmu_attitude_and_position(dt);

	renderer.render( scene, camera );
});



function update() {
  controls.update();
  if (astronaut != null && astronaut.loaded) {
    /*
    cubeCamera.position.copy(astronaut.visor.position);
    astronaut.visor.visible = false;
    cubeCamera.update(renderer, scene);
    astronaut.visor.visible = true;
    */
  }
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
window.environment = environment;
window.mmu = mmu;
