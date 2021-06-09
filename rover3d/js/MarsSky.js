import * as THREE from './three.module.js';
import { Sky } from './Sky.js';

let deg2rad = Math.PI/180;
let rad2deg = 180/Math.PI;

let sky = {};


sky.load = function(scene, params){

  sky.turbidity = (params && params.turbidity) || 1.0;
  sky.rayleigh  = (params && params.rayleigh)  || 0.01;
  sky.mie       = (params && params.mie)       || 0.0003;
  sky.mieDirectionality = (params && params.mieDirectionality) || 0.9;
  sky.diffuseLightColor = (params && params.diffuseLightColor) || 0xffe7d3;
  sky.diffuseLightIntensity = (params && params.diffuseLightIntensity) || 0.25;
  sky.diffuseLightMaxIntensity = (params && params.diffuseLightMaxIntensity) || 0.25;
  sky.up       = (params && params.up) || new THREE.Vector3(0, 0, -1);
  
  
  // Add Sky shader
  sky.shader = new Sky();
  sky.shader.scale.setScalar( 45000 );
  sky.shader.material.uniforms.turbidity.value        = sky.turbidity;
  sky.shader.material.uniforms.rayleigh.value         = sky.rayleigh;
  sky.shader.material.uniforms.mieCoefficient.value   = sky.mie;
  sky.shader.material.uniforms.mieDirectionalG.value  = sky.mieDirectionality;
  sky.shader.material.uniforms.up.value               = sky.up;
  scene.add( sky.shader );


  sky.sun = {
    pos:  new THREE.Vector3(),
    az: -90, 
    el: 45, 
    dist: 20000, 
    x:0, 
    y:0, 
    z:0, 
    intensity:     0.75,
    lightColor:    0xffe2b7,
    maxIntensity:  0.6,
    minLightFraction: 0.01,  //light intensity with sun at zero el
    maxElQuadraticLight: 15, //elevation (deg) below which light falls off quadratically
  }


  // Make lighting:
  sky.diffuseLight = new THREE.AmbientLight( sky.diffuseLightColor );
  sky.diffuseLight.intensity = sky.diffuseLightIntensity;
  scene.add( sky.diffuseLight );

  // Define 2 directional lights with different shadow map scales
  sky.sun.lights = new THREE.Group();
  sky.sun.lights.name = "lights";
  scene.add(sky.sun.lights);

  // Light1 with narrow shadow map:
  sky.sun.light1 = new THREE.DirectionalLight(sky.sun.lightColor, sky.sun.intensity);
  sky.sun.light1.castShadow = true;
  sky.sun.light1.shadow.camera.near = 1000;
  sky.sun.light1.shadow.camera.far = (sky.sun.dist + 8192)*1.2; //
  sky.sun.light1.shadow.mapSize.width = 1024;
  sky.sun.light1.shadow.mapSize.height = 1024;
  sky.sun.lights.add( sky.sun.light1 );

  // Light2 with broad shadow map:
  sky.sun.light2 = sky.sun.light1.clone();
  sky.sun.light2.shadow.mapSize.width = 1024;
  sky.sun.light2.shadow.mapSize.height = 1024;
  sky.sun.light2.shadow.camera.top = 4000;
  sky.sun.light2.shadow.camera.bottom = -4000;
  sky.sun.light2.shadow.camera.left = -4000;
  sky.sun.light2.shadow.camera.right = 4000;
  /*if(!ismobile)*/ sky.sun.lights.add( sky.sun.light2 );

  //Create a helper for the shadow camera
  //const helper = new THREE.CameraHelper( sky.sun.light1.shadow.camera );
  //scene.add( helper );

  // Define coefficients for sunset darkening
  sky.sun.extinctionCoeffs = [
    (sky.sun.minLightFraction-1)/(sky.sun.maxElQuadraticLight*sky.sun.maxElQuadraticLight),
    -2*(sky.sun.minLightFraction-1)/sky.sun.maxElQuadraticLight,
    sky.sun.minLightFraction
  ];

}
  
  
  
sky.placeSun = function(sunCfg, surfaceColor){
  console.log(sunCfg);
  const az = sunCfg.az;
  const el = sunCfg.el;
  surfaceColor = surfaceColor || 0xaf9681;
  console.log([az, el]);
  const minEl = -2;
  var sunX = sky.sun.dist * Math.cos(el * deg2rad) * Math.sin(az * deg2rad );
  var sunZ = sky.sun.dist * Math.cos(el * deg2rad) * Math.cos(az * deg2rad )*-1;
  var sunY = sky.sun.dist * Math.sin(Math.max(minEl,el) * deg2rad);
  sky.sun.pos.set(sunX, sunY, sunZ);
  console.log(sky.sun.pos);
  sky.sun.lights.position.set(sunX, sunY, sunZ);
  sky.shader.material.uniforms[ "sunDirection" ].value.copy( sky.sun.pos.normalize() );
  var intensityMultiplier = 1;
  var sunEl = Math.max(0, el<90? el : 180-el);
  if(sunEl<sky.sun.maxElQuadraticLight){
    // Quadratic extinction
    intensityMultiplier = sky.sun.extinctionCoeffs[0]*sunEl*sunEl + sky.sun.extinctionCoeffs[1]*sunEl + sky.sun.extinctionCoeffs[2];
  }
  console.log("intensityMultiplier: " + intensityMultiplier);
  sky.diffuseLight.intensity = sky.diffuseLightMaxIntensity * intensityMultiplier * intensityMultiplier;
  sky.sun.intensity = sky.sun.maxIntensity * intensityMultiplier;
  sky.sun.light1.intensity = sky.sun.intensity;
  sky.sun.light2.intensity = sky.sun.intensity;
  
  //Update fog:
  sky.fogColor = interpHex(surfaceColor, sky.diffuseLightColor, 0.3);  // blend of terrain and diffuse light color
  scene.fog.color = new THREE.Color(sky.fogColor).multiplyScalar(intensityMultiplier*intensityMultiplier*0.5);
  //requestRenderIfNotRequested();
}


function interpHex(hex1, hex2, ratio){
  console.log([hex1, hex2]);
  const rgb1 = hex1.toString(16).padStart(6, '0').match(/.{1,2}/g);
  const rgb2 = hex2.toString(16).padStart(6, '0').match(/.{1,2}/g);
  var hex = [];
  for(var i=0; i<3; i++){
    hex[i] = Math.ceil(parseInt(rgb1[i],16)*(1-ratio) + parseInt(rgb2[i],16)*ratio).toString(16).padStart(2, '0');
  }
  //console.log([rgb1, rgb2, hex])
  return parseInt('' + hex[0] + hex[1] + hex[2], 16);
}
  
  
export { sky };