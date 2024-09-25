

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';



let camera, scene, renderer, astronaut, spacecraft;
let cubeRenderTarget, cubeCamera, reflectiveMaterial;

scene = new THREE.Scene();
scene.background = 0x000000;
window.scene = scene;

camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.up.set(0,0,1);
window.camera = camera;

renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.antialis = true;
document.body.appendChild( renderer.domElement );
window.renderer = renderer;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

scene.background = new THREE.CubeTextureLoader()
	.setPath( 'assets/background/2k/' )
	.load( ['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png' ]);
  

const controls = new OrbitControls(camera, renderer.domElement)


// Add lights to the scene
const ambientLight = new THREE.AmbientLight(0xffffff);
ambientLight.intensity = 0.2;
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff);
directionalLight.position.set(10, -500, 20);
directionalLight.intensity = 4;
directionalLight.castShadow = true; // default false
directionalLight.shadow.mapSize.width = 512; // default
directionalLight.shadow.mapSize.height = 512; // default
directionalLight.shadow.camera.near = 0.1; // default
directionalLight.shadow.camera.far = 1000; // default
scene.add(directionalLight);


const pointLight = new THREE.PointLight(0xffffff, 5, 1);
pointLight.position.set(10, 100, 20); // Set the position of the light
pointLight.intensity = 20;
scene.add(pointLight);

const textureLoader = new THREE.TextureLoader();
const textureFlare0 = textureLoader.load( "./assets/lensflare/flare0.png" );
const textureFlare1 = textureLoader.load( "./assets/lensflare/flare1.png" );
const textureFlare2 = textureLoader.load( "./assets/lensflare/flare2.png" );
const textureFlare3 = textureLoader.load( "./assets/lensflare/flare3.png" );
const lensflare = new Lensflare();


lensflare.addElement( new LensflareElement( textureFlare0, 160, 0 ) );
lensflare.addElement( new LensflareElement( textureFlare3, 500, 0.02 ) );
lensflare.addElement( new LensflareElement( textureFlare0, 120,  0 ) );
lensflare.addElement( new LensflareElement( textureFlare3, 80,  0.05 ) );
lensflare.addElement( new LensflareElement( textureFlare3, 120, 0.55 ) );
lensflare.addElement( new LensflareElement( textureFlare3, 240, 0.65 ) );
lensflare.addElement( new LensflareElement( textureFlare3, 120, 0.75 ) );
directionalLight.add( lensflare );


camera.position.set(15,-4,-1.5);


const gltf_loader = new GLTFLoader();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath( 'three/examples/jsm/libs/draco/' );
gltf_loader.setDRACOLoader( dracoLoader );


cubeRenderTarget = new THREE.WebGLCubeRenderTarget( 512 );
cubeRenderTarget.texture.type = THREE.HalfFloatType;
cubeCamera = new THREE.CubeCamera( 1, 1000, cubeRenderTarget );
cubeCamera.up.set(0, 0, 1);
window.cubeCamera = cubeCamera;

reflectiveMaterial = new THREE.MeshStandardMaterial( {
  envMap: cubeRenderTarget.texture,
  roughness: 0.2,
  metalness: 1,
  shininess: 1,
  color: 0xffaa66,
} );

console.log('cubeCamera:', cubeCamera);


// Load the spacecraft
gltf_loader.load(
  './assets/blender_model/europa_clipper.glb',
  function (gltf) {
    spacecraft = gltf.scene.children[0];
    console.log(spacecraft)
    scene.add(spacecraft);
    spacecraft.solar_array = spacecraft.children[10].rotation.set(0,0,0)
    window.spacecraft = spacecraft;
  },
	function ( xhr ) {
		//console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
	},
	function ( error ) {
		console.log( 'An error happened' );
	}
);



// Load the astronaut
gltf_loader.load(
  './assets/blender_model/astronaut.glb',
  function (gltf2) {
    astronaut = gltf2.scene.children[0];
    console.log(astronaut)
    scene.add(astronaut);
    console.log("astronaut:",astronaut);
    astronaut.position.set(-2, -4, 0.5);
    astronaut.rotation.set(0.2, 0.2, 0.4, 'XYZ');
    //astronaut.rotation.set(0,0,-1.571,'XYZ');
    //spacecraft.solar_array = spacecraft.children[0].children[10].rotation.set(0,0,0)
    
    astronaut.traverse((child) => {
      if ( ! child.isMesh ) return;
      //var prevMaterial = child.material;
      //child.material = new THREE.MeshPhongMaterial();
      child.material.shininess = 1;
      //child.material.envMap = cubeCamera.renderTarget.texture;
      if( child.name == "visor"){
        console.log('setting visor');
        astronaut.visor = child;
        astronaut.visor.material = reflectiveMaterial;
        cubeCamera.position.copy(astronaut.visor.position);
        astronaut.visor.material.envMap = cubeRenderTarget.texture;

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

//document.body.appendChild(stats.dom)

function update() {
  controls.update();
  if (astronaut != null && astronaut.loaded) {
    cubeCamera.position.copy(astronaut.visor.position);
    astronaut.visor.visible = false;
    cubeCamera.update(renderer, scene);
    astronaut.visor.visible = true;
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


animate();

