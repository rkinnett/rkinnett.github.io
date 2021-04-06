import {
	BackSide,
	BoxGeometry,
	Mesh,
	ShaderMaterial,
  TextureLoader,
	UniformsUtils,
	Vector3
} from './three.module.js';

/**
 * Mars Sky Shader by Ryan Kinnett, 2021
 * adapted from:
 * "The sun, the sky and the clouds" by StillTravelling, https://www.shadertoy.com/view/tdSXzD
 *   which, in turn is based on:
 *    "Weather" by David Hoskins, https://www.shadertoy.com/view/4dsXWn
 *    "Edge of atmosphere" by Dmytro Rubalskyi, https://www.shadertoy.com/view/XlXGzB
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

	Mesh.call(this, new BoxGeometry( 1, 1, 1 ), material);
};

Sky.prototype = Object.create( Mesh.prototype );

Sky.SkyShader = {

	uniforms: {
    'cloudAbundance':     {value: 0.2}, //0.0 (clear sky) to 0.5
    'cloudTransparency':  {value: 5.0}, //5.0, higher value makes clouds more visible
    'cloudSpeedX':        {value: 1e2}, //{-20e2:20e2} (m/s?)
    'cloudSpeedZ':        {value: -20e2}, //{-20e2:20e2} (m/s?)
		'haze':               {value: 0.01},
		'sunPosition':        {value: new Vector3()},
    'iChannel0':          {value: new TextureLoader()},
	},

	vertexShader: [
		'uniform vec3 sunPosition;',
    
		'varying vec3 vWorldPosition;',
		'varying vec3 vSunDirection;',

		'void main() {',

		'	vec4 worldPosition = modelMatrix * vec4( position, 1.0 );',
		'	vWorldPosition = worldPosition.xyz;',

		'	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
		'	gl_Position.z = gl_Position.w;', // set z to camera.far

		'	vSunDirection = normalize( sunPosition );',
		'}'
	].join( '\n' ),

	fragmentShader: [`
#include <common>

varying vec3 vWorldPosition;
varying vec3 vSunDirection;

uniform vec3 iResolution;
uniform float iTime;
uniform vec3 sunPosition;
uniform sampler2D iChannel0;

#define t iTime

const float cloudy = 0.2; //0.0 clear sky //0.5
const float haze = 0.01 * (cloudy*20.);
const float cloudstrength = 5.0; // makes clouds thicker // 5.0

const float mincloudheight = 9e3; //5e3
const float maxcloudheight = 14e3; //8e3
const float cloudnoise = 2e-4; //2e-4

const float fov = tan(radians(60.0));
const float cloudspeedx = 1e2; //5e2
const float cloudspeedz = -20e2; //6e2


//Performance
const int steps = 16; //16 is fast, 128 or 256 is extreme high
const int stepss = 16; //16 is fast, 16 or 32 is high 

//Environment
const float R0 = 3390e3; //planet radius //6360e3 actual 6371km
const float Ra = R0 + 40e3; //atmosphere radius //6380e3 troposphere 8 to 14.5km
const float I = 12.; //sun light power, 10.0 is normal
const float SI = 4.; //sun intensity for sun
const float g = 0.35; //light concentration .76 //.45 //.6  .45 is normaL
const float g2 = g * g;

const float s = 0.99995; //light concentration for sun
const float s2 = s;     //soft sun
const float Hr = 8e3; //Rayleigh scattering top //8e3
const float Hm = 1.2e3; //Mie scattering top //1.3e3

//vec3 bM = vec3(21e-6); //normal mie // vec3(21e-6)
vec3 bM = vec3(8e-6); //normal mie // vec3(21e-6)
//vec3 bM = vec3(50e-6); //high mie

//Rayleigh scattering (sky color, atmospheric up to 8km)
//vec3 bR = vec3(5.8e-6, 13.5e-6, 33.1e-6); //normal earth
vec3 bR = vec3(14e-6, 8e-6, 4e-6); //normal Mars

vec3 C = vec3(0., -R0, 0.); //planet center
vec3 Ds = normalize(vec3(0., 0., -1.)); //sun direction?

float cloudnear = 6.0; //do not render too close
float cloudfar = 60e3; //~100km max


const vec3 cameraPos = vec3( 0.0, 0.0, 0.0 );

float noise(in vec2 v) { 
    return textureLod(iChannel0, (v+.5)/256., 0.).r; 
}

// by iq
float Noise( in vec3 x )
{
    vec3 p = floor(x);
    vec3 f = fract(x);
	f = f*f*(3.0-2.0*f);

	vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
	vec2 rg = texture( iChannel0, (uv+ 0.5)/256.0, -100.0).yx;
	return mix( rg.x, rg.y, f.z );
}


float fnoise( vec3 p, in float t )
{
	p *= .25;
    float f;

	f = 0.5000 * Noise(p); p = p * 3.02; p.y -= t*.1; //t*.05 speed cloud changes
	f += 0.2500 * Noise(p); p = p * 3.03; p.y += t*.06; //0.06
	f += 0.1250 * Noise(p); p = p * 3.01;
	f += 0.0625   * Noise(p); p =  p * 3.03;
	f += 0.03125  * Noise(p); p =  p * 3.02;
	f += 0.015625 * Noise(p);
    return f;
}

float cloud(vec3 p, in float t ) {
	float cld = fnoise(p*cloudnoise,t) + cloudy*0.1 ;
	cld = smoothstep(.4+.04, .6+.04, cld);
	cld *= cld * (5.0*cloudstrength);
	return cld+haze;
}

void densities(in vec3 pos, out float rayleigh, out float mie) {
	float h = length(pos - C) - R0;
	rayleigh =  exp(-h/Hr);
	vec3 d = pos;
    d.y = 0.0;
    float dist = length(d);
    
	float cld = 0.;
	if (mincloudheight < h && h < maxcloudheight) {
		//cld = cloud(pos+vec3(t*1e3,0., t*1e3),t)*cloudy;
        cld = cloud(pos+vec3(cloudspeedx*t, 0., cloudspeedz*t),t)*cloudy; //direction and speed the cloud movers
		cld *= sin(3.1415*(h-mincloudheight)/mincloudheight) * cloudy;
	}

    if (dist>cloudfar) {
        float factor = clamp(1.0-((dist - cloudfar)/(cloudfar-cloudnear)),0.0,1.0);
        cld *= factor;
    }

	mie = exp(-h/Hm) + cld + haze;
}



float escape(in vec3 p, in vec3 d, in float R) {
	vec3 v = p - C;
	float b = dot(v, d);
	float c = dot(v, v) - R*R;
	float det2 = b * b - c;
	if (det2 < 0.) return -1.;
	float det = sqrt(det2);
	float t1 = -b - det, t2 = -b + det;
	return (t1 >= 0.) ? t1 : t2;
}

// this can be explained: http://www.scratchapixel.com/lessons/3d-advanced-lessons/simulating-the-colors-of-the-sky/atmospheric-scattering/
void scatter(vec3 o, vec3 d, out vec3 col, out vec3 scat, in float t) {
    
	float L = escape(o, d, Ra);	
	float mu = dot(d, Ds);
	float opmu2 = 1. + mu*mu;
	float phaseR = .0596831 * opmu2;
	float phaseM = .1193662 * (1. - g2) * opmu2 / ((2. + g2) * pow(1. + g2 - 2.*g*mu, 1.5));
    float phaseS = .1193662 * (1. - s2) * opmu2 / ((2. + s2) * pow(1. + s2 - 2.*s*mu, 1.5));
	
	float depthR = 0., depthM = 0.;
	vec3 R = vec3(0.), M = vec3(0.);
	
	float dl = L / float(steps);
	for (int i = 0; i < steps; ++i) {
		float l = float(i) * dl;
		vec3 p = (o + d * l);

		float dR, dM;
		densities(p, dR, dM);
		dR *= dl; dM *= dl;
		depthR += dR;
		depthM += dM;

		float Ls = escape(p, Ds, Ra);
		if (Ls > 0.) {
			float dls = Ls / float(stepss);
			float depthRs = 0., depthMs = 0.;
			for (int j = 0; j < stepss; ++j) {
				float ls = float(j) * dls;
				vec3 ps = ( p + Ds * ls );
				float dRs, dMs;
				densities(ps, dRs, dMs);
				depthRs += dRs * dls;
				depthMs += dMs * dls;
			}

			vec3 A = exp(-(bR * (depthRs + depthR) + bM * (depthMs + depthM)));
			R += (A * dR);
			M += A * dM ;
		} else {
		}
	}

    col  = (I) *(M * bM * phaseM); //Mie scattering
    col += (SI)*(M * bM * phaseS); //Sun
    col += (I) *(R * bR * phaseR); //Rayleigh scattering
    //scat = 0.1 *(bM*depthM)*2.;
}


vec3 hash33(vec3 p)
{
    p = fract(p * vec3(443.8975,397.2973, 491.1871)); //?RK
    p += dot(p.zxy, p.yxz+19.27); //?RK
    return fract(vec3(p.x*p.y, p.z*p.x, p.y*p.z));
}

vec3 stars(in vec3 p)
{
    vec3 c = vec3(0.);
    float res = iResolution.x*2.5;

	for (float i=0.;i<4.;i++)
    {
        vec3 q = fract(p*(.15*res))-0.5;
        vec3 id = floor(p*(.15*res));
        vec2 rn = hash33(id).xy;
        float c2 = 1.-smoothstep(0.,.6,length(q));
        c2 *= step(rn.x,.0005+i*i*0.001);
        c += c2*(mix(vec3(1.0,0.49,0.1),vec3(0.75,0.9,1.),rn.y)*0.1+0.9); //?RK
        p *= 1.3;
    }
    return c*c*.8;
}



void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
  
    float att = 0.9;  //0.8  affects sky brightness overall

	float AR = iResolution.x/iResolution.y;
    float M = 1.0; //canvas.innerWidth/M //canvas.innerHeight/M --res
    
    //vec2 uvMouse = (iMouse.xy / iResolution.xy);
    //uvMouse.x *= AR;
    
   	vec2 uv0 = (fragCoord.xy / iResolution.xy);
    uv0 *= M;
    
    vec2 uv = uv0 * (2.0*M) - (1.0*M);
    uv.x *=AR;
    
  
    //if (uvMouse.y == 0.) uvMouse.y=(0.7-(0.05*fov)); //initial view 
    //if (uvMouse.x == 0.) uvMouse.x=(1.0-(0.05*fov)); //initial view
    
	//Ds = normalize(vec3(uvMouse.x-((0.5*AR)), uvMouse.y-0.5, (fov/-2.0)));
  Ds = vSunDirection;
    
    
	vec3 O = vec3(0., 0., 0.);
	vec3 D = normalize(vec3(uv, -(fov*M)));

	vec3 color = vec3(0.);


	if (D.y > -1.5) {
    vec3 scat = vec3(0.);
    
    float staratt = 1. -min(1.0,(Ds.y*0.5)); 
    float scatatt = 1. -min(1.0,(Ds.y*30.2));

    float L1 =  O.y / D.y;
		vec3 O1 = O + D * L1;

    vec3 D1 = vec3(1.);
    //D1 = normalize(D+vec3(1.,0.0009*sin(t*0.+6.2831*noise(O1.xz+vec2(0.,t*0.8*0.))),0.)); // twinkle
    D1 = normalize(D+vec3(1.,0.0009*sin(noise(O1.xz)),0.));
    vec3 star = stars(D1);
    scatter(O, D, color, scat, t);
    
    star *= att;
    star *= staratt;

    color *= att;
    scat *=  att;
    scat *= scatatt;

    color += scat;
    color += star;
  }

	fragColor = vec4(pow(color, vec3(1.0/2.2)), 1.); //gamma correct
}

void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}

  `].join( '\n' )

};

export { Sky };
