import {
	BackSide,
	BoxGeometry,
	Mesh,
	ShaderMaterial,
	UniformsUtils,
	Vector3,
  Vector2,
  Texture,
} from './three.module.js';

/**
 * 
*/

var Sky = function () {

	var shader = Sky.SkyShader;

	var material = new ShaderMaterial( {
		name: 'SkyShader',
		fragmentShader: shader.fragmentShader,
		vertexShader: shader.vertexShader,
		uniforms: UniformsUtils.clone( shader.uniforms ),
		side: BackSide,
		depthWrite: false
	} );

	Mesh.call( this, new BoxGeometry( 1, 1, 1 ), material );

};

Sky.prototype = Object.create( Mesh.prototype );

Sky.SkyShader = {

	uniforms: {    
    'rotation': { value: 0.5},
    'center':   { value: new Vector2( 0, 0) },
    'uTxtShape': {value: new Texture() },
    'uTxtCloudNoise': {value: new Texture() },
    'uTime': { value: 0.5},
    'uFac1': { value: 0.5},
    'uFac2': { value: 0.5},
    'uTimeFactor1': { value: 0.5},
    'uTimeFactor2': { value: 0.5},
    'uDisplStrenght1': { value: 0.5},
    'uDisplStrenght2': { value: 0.5},
	},

	vertexShader: [`
uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

varying vec2 vUv;

void main() {
	// #include <uv_vertex>
  vUv = uv;

	vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
	vec2 scale;
	scale.x = length( vec3( modelMatrix[ 0 ].x, modelMatrix[ 0 ].y, modelMatrix[ 0 ].z ) );
	scale.y = length( vec3( modelMatrix[ 1 ].x, modelMatrix[ 1 ].y, modelMatrix[ 1 ].z ) );

	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}
	`],

	fragmentShader: [`
#pragma glslify: fbm3d = require('glsl-fractal-brownian-noise/3d')
#pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
#pragma glslify: levels = require('./levels')


uniform sampler2D uTxtShape;
uniform sampler2D uTxtCloudNoise;
uniform float uTime;

uniform float uFac1;
uniform float uFac2;
uniform float uTimeFactor1;
uniform float uTimeFactor2;
uniform float uDisplStrenght1;
uniform float uDisplStrenght2;

varying vec2 vUv;

void main() {
    vec2 newUv = vUv;

    vec4 txtNoise1 = texture2D(uTxtCloudNoise, vec2(vUv.x + uTime * 0.0001, vUv.y - uTime * 0.00014)); // noise txt
    vec4 txtNoise2 = texture2D(uTxtCloudNoise, vec2(vUv.x - uTime * 0.00002, vUv.y + uTime * 0.000017 + 0.2)); // noise txt

    float noiseBig = fbm3d(vec3(vUv * uFac1, uTime * uTimeFactor1), 4)+ 1.0 * 0.5;
    newUv += noiseBig * uDisplStrenght1;

    float noiseSmall = snoise3(vec3(newUv * uFac2, uTime * uTimeFactor2));

    newUv += noiseSmall * uDisplStrenght2;

    vec4 txtShape = texture2D(uTxtShape, newUv);

    float alpha = levels((txtNoise1 + txtNoise2) * 0.6, 0.2, 0.4, 0.7).r;
    alpha *= txtShape.r;

    gl_FragColor = vec4(vec3(0.95,0.95,0.95), alpha);
}
`]
};

export { Sky };
