import {
	BackSide,
	BoxGeometry,
	Mesh,
	ShaderMaterial,
	UniformsUtils,
	Vector3
} from './three.module.js';

/**
 * Based originally on mrdoob's three.js webgl sky shader demo:
 * https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/Sky.js
 *
 *   Which is in turn based on:
 *     Three.js integration by zz85 http://twitter.com/blurspline
 *
 *     "A Practical Analytic Model for Daylight"
 *       aka The Preetham Model, the de facto standard analytic skydome model
 *       https://www.researchgate.net/publication/220720443_A_Practical_Analytic_Model_for_Daylight
 *
 *     First implemented by Simon Wallner
 *       http://www.simonwallner.at/projects/atmospheric-scattering
 *
 *     Improved by Martin Upitis
 *       http://blenderartists.org/forum/showthread.php?245954-preethams-sky-impementation-HDR
 *
 * Mars adaptation by Ryan Kinnett, 2021
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
		'turbidity': { value: 12 },
		'rayleigh': { value: 0.1 },
		'mieCoefficient': { value: 0.005 },
		'mieDirectionalG': { value: 0.85 },
		'sunPosition': { value: new Vector3() },
		'up': { value: new Vector3( 0, 0, -1 ) }
	},

	vertexShader: [
		'uniform vec3 sunPosition;',
		'uniform float rayleigh;',
		'uniform float turbidity;',
		'uniform float mieCoefficient;',
		'uniform vec3 up;',

		'varying vec3 vWorldPosition;',
		'varying vec3 vSunDirection;',
		'varying float vSunfade;',
		'varying vec3 vBetaR;',
		'varying vec3 vBetaM;',
		'varying float vSunE;',

		'const float e = 2.71828182845904523536028747135266249775724709369995957;',
		'const float pi = 3.141592653589793238462643383279502884197169;',
    'const float piOver2 = 1.57079632679;',

    'const vec3 totalRayleigh = vec3( 3.4E-4, 2.0E-4, 0.9E-4 );',  // RK: Rayleight scatter color (main sky color)

		'const vec3 MieConst = vec3( 1.6, 3.6, 6.1 );',  // RK: Mie scattering "color"

    'const float sunIntensityVsElevation = 1.0;', //(~1-10) (1.5 orig, 2.5 mars) RK: affects sky brightness vs sun elevation, higher=brighter
		'const float sunIntensityZenith = 400.0;',  //(1.0-4000.0) RK: sky brightness scalar
    

		'void main() {',

		'	vec4 worldPosition = modelMatrix * vec4( position, 1.0 );',
		'	vWorldPosition = worldPosition.xyz;',
		'	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
		'	gl_Position.z = gl_Position.w;',
		'	vSunDirection = normalize( sunPosition );',
		'	float zenithAngleCos = clamp( dot( vSunDirection, up ), -1.0, 1.0);',
    '	vSunE = sunIntensityZenith * max( 0.0, 1.0 - pow( e, -( ( piOver2 - acos( zenithAngleCos ) ) / sunIntensityVsElevation ) ) );',
		'	vSunfade = 1.0 - clamp( 1.0 - exp( ( -1.0 * vSunDirection.z ) ), 0.0, 1.0 );',

		'	float rayleighCoefficient = rayleigh - ( 1.0 * ( 1.0 - vSunfade ) );',
		'	vBetaR = totalRayleigh * rayleighCoefficient;',

    ' vec3 totalMie = 0.434 * ( 0.2 * turbidity ) * 10E-4 * MieConst;',
		'	vBetaM = totalMie * mieCoefficient;',
		'}'
	].join( '\n' ),

	fragmentShader: [
		'varying vec3 vWorldPosition;',
		'varying vec3 vSunDirection;',
		'varying float vSunfade;',
		'varying vec3 vBetaR;',
		'varying vec3 vBetaM;',
		'varying float vSunE;',

		'uniform float mieDirectionalG;',
		'uniform vec3 up;',

		'const vec3 cameraPos = vec3( 0.0, 0.0, 0.0 );',

		'const float pi = 3.141592653589793238462643383279502884197169;',
		'const float THREE_OVER_SIXTEENPI = 0.05968310365946075;',
		'const float ONE_OVER_FOURPI = 0.07957747154594767;',


		// optical length at zenith
		'const float rayleighZenithLength   = 4.0E3;',   //RK: affects Rayleigh scattering intensity (10.0E3)
		'const float mieZenithLength        = 1.0E3;',   //RK: affects Mie scattering intensity (5.0E3)

    // sun disk
    'const float sunAngularDiameterCos  = 0.99998;',  //RK: higher value = smaller sun disk


		'float rayleighPhase( float cosTheta ) {',
		'	return THREE_OVER_SIXTEENPI * ( 1.0 + pow( cosTheta, 2.0 ) );',
		'}',

		'float hgPhase( float cosTheta, float g ) {',
		'	float g2 = pow( g, 2.0 );',
		'	float inverse = 1.0 / pow( 1.0 - 2.0 * g * cosTheta + g2, 1.5 );',
		'	return ONE_OVER_FOURPI * ( ( 1.0 - g2 ) * inverse );',
		'}',

		'void main() {',

		'	vec3 direction = normalize( vWorldPosition - cameraPos );',

		// optical length
		'	float zenithAngle = acos( max( 0.0, dot( up, direction ) ) );',
		'	float inverse = 1.0 / ( cos( zenithAngle ) + 0.000940 * pow( 1.638602368 - zenithAngle, -1.253 ) );',
		'	float sR = rayleighZenithLength * inverse;',
		'	float sM = mieZenithLength * inverse;',

		// combined extinction factor
		'	vec3 Fex = exp( -( vBetaR * sR + vBetaM * sM ) );',

		// in-scattering
		'	float cosTheta = dot( direction, vSunDirection );',

		'	float rPhase = rayleighPhase( cosTheta * 0.5 + 0.5 );',
		'	vec3 betaRTheta = vBetaR * rPhase;',

		'	float mPhase = hgPhase( cosTheta, mieDirectionalG );',
		'	vec3 betaMTheta = vBetaM * mPhase;',

		'	vec3 Lin = pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * ( 1.0 - Fex ), vec3( 1.5 ) );',
		'	Lin *= mix( vec3( 1.0 ), pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * Fex, vec3( 0.5 ) ), clamp( pow( 1.0 - dot( up, vSunDirection ), 5.0 ), 0.0, 1.0 ) );',

		'	vec3 L0 = vec3( 0.1 ) * Fex;',

		// composition + solar disc
		'	float sundisk = smoothstep( sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta );',
		'	L0 += ( vSunE * 19000.0 * Fex ) * sundisk;',
		'	vec3 texColor = ( Lin + L0 ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 );',
		'	vec3 retColor = pow( texColor, vec3( 1.0 / ( 1.2 + ( 1.2 * vSunfade ) ) ) );',
		' gl_FragColor = vec4( retColor, 1.0 );',

		'#include <tonemapping_fragment>',
		'#include <encodings_fragment>',

		'}'
	].join( '\n' )

};

export { Sky };
