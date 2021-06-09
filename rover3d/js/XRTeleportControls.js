import {
	Line,
	Raycaster,
	Vector3,
	MathUtils,
	BufferAttribute,
	EventDispatcher,
} from './three.module.js';

// https://developer.oculus.com/blog/teleport-curves-with-the-gear-vr-controller/

const horizontalDirection = new Vector3();
const forwardDirection = new Vector3();
const horizontalPoint = new Vector3();
const downVector = new Vector3( 0, - 1, 0 );
const sampleVector = new Vector3();
const controlPoint = new Vector3();
const Q0 = new Vector3();
const Q1 = new Vector3();

const tempVector0 = new Vector3();
const tempVector1 = new Vector3();

function sampleCurve( start, end, control, t, target ) {

	Q0.lerpVectors( start, control, t );

	Q1.lerpVectors( control, end, t );

	target.lerpVectors( Q0, Q1, t );

}

export class XRTeleportControls extends EventDispatcher {

	get enabled() {

		return this._enabled;

	}

	set enabled( v ) {

		this._enabled = v;
		this._arc.visible = v;
		if ( ! v && this.hit ) {

			this.dispatchEvent( { type: 'end-hit' } );
			this.hit = false;

		}

	}

	constructor( controller, playSpace, castScene ) {

		super();

		this._enabled = true;
		this.arc = new Line();
		this.arc.frustumCulled = false;
		this.controller = controller;
		this.castScene = castScene;
		this.raycaster = new Raycaster();
		this.playSpace = playSpace;

		this.hit = false;
		this.hitPoint = new Vector3();
		this.hitInfo = null;

		this.samples = 25;
		this.minControllerAngle = 60;
		this.maxControllerAngle = 120;
		this.maxDistance = 20;
		this.minDistance = .1;
		this.castHeight = 6;

		this._selectStartCallback = () => {

			if ( ! this.enabled || ! this.hit ) {

				return;

			}

			this.getPlaySpaceAdjustedPosition( playSpace.position );

		};

		controller.addEventListener( 'selectstart', this._selectStartCallback );

	}

	getPlaySpaceAdjustedPosition( target ) {

		const { playSpace, controller, hitPoint } = this;
		const parent = playSpace.parent;

		const controllerWorld = tempVector0;
		const playSpaceWorld = tempVector1;

		controllerWorld.set( 0, 0, 0 ).applyMatrix4( controller.matrixWorld );
		playSpaceWorld.set( 0, 0, 0 ).applyMatrix4( playSpace.matrixWorld );

		playSpaceWorld.sub( controllerWorld );
		playSpaceWorld.y = 0;

		playSpaceWorld.add( hitPoint );

		target.copy( playSpaceWorld );

		parent.worldToLocal( target );

	}

	update() {

		if ( this.enabled === false ) {

			return;

		}

		const {
			arc,
			raycaster,
			controller,
			samples,
			minControllerAngle,
			maxControllerAngle,
			maxDistance,
			minDistance,
			castHeight,
			castScene,
		} = this;
		const { ray } = raycaster;
		const { origin, direction } = ray;

		origin.set( 0, 0, 0 ).applyMatrix4( controller.matrixWorld );
		forwardDirection.set( 0, 0, - 1 ).transformDirection( controller.matrixWorld ).normalize();
		horizontalDirection.copy( forwardDirection );
		horizontalDirection.y = 0;
		horizontalDirection.normalize();

		// get the target horizontal ray point
		const controllerAngle = forwardDirection.angleTo( downVector ) * MathUtils.RAD2DEG;
		const pitch = MathUtils.clamp( controllerAngle, minControllerAngle, maxControllerAngle );
		const pitchRange = maxControllerAngle - minControllerAngle;
		const t = ( pitch - minControllerAngle ) / pitchRange;
		const horizontalDistance = MathUtils.lerp( minDistance, maxDistance, t );

		horizontalPoint.copy( origin ).addScaledVector( horizontalDirection, horizontalDistance );

		// construct tall ray
		origin.y += castHeight;
		direction.copy( horizontalPoint ).sub( origin ).normalize();

		const hit = raycaster.intersectObject( castScene, true )[ 0 ];
		if ( hit && hit.face.normal.y > 0 ) {

			const point = hit.point;
			if ( ! arc.geometry.attributes.position || arc.geometry.attributes.position.count !== samples * 3 ) {

				arc.geometry.setAttribute(
					'position',
					new BufferAttribute( new Float32Array( samples * 3 ), 3 ),
				);

			}

			// adjust origin back to controller position
			origin.y -= castHeight;

			// get the center position from the origin to hit point
			controlPoint.lerpVectors( origin, point, 0.5 );
			controlPoint.y = 0;

			// projected forward
			horizontalDirection.copy( forwardDirection );
			horizontalDirection.y = 0;

			// projected hit point
			tempVector0.copy( point ).sub( origin ).multiplyScalar( 0.5 );
			tempVector0.y = 0;

			const controllerDirectionHeight = forwardDirection.y * tempVector0.length() / horizontalDirection.length();
			const arcHeight = MathUtils.lerp( 0.1, 1.0, horizontalDistance / maxDistance );
			controlPoint.y = Math.max( origin.y, point.y + arcHeight, origin.y + controllerDirectionHeight );

			const positionAttr = arc.geometry.getAttribute( 'position' );
			for ( let i = 0; i < samples; i ++ ) {

				const t = i / ( samples - 1 );
				sampleCurve( origin, point, controlPoint, t, sampleVector );
				positionAttr.setXYZ( i, sampleVector.x, sampleVector.y, sampleVector.z );

			}

			positionAttr.needsUpdate = true;

			const wasHit = this.hit;
			this.hit = true;
			this.hitInfo = hit;
			this.hitPoint.copy( point );
			arc.visible = true;

			if ( ! wasHit ) {

				this.dispatchEvent( { type: 'start-hit' } );

			}

		} else {

			const wasHit = this.hit;
			this.hit = false;
			this.hitInfo = null;
			arc.visible = false;

			if ( wasHit ) {

				this.dispatchEvent( { type: 'end-hit' } );

			}

		}

	}

	dispose() {

		this.controller.removeEventListener( 'selectstart', this._selectStartCallback );

	}

}
