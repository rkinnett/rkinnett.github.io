import {
	Group,
} from './three.module.js';

// Represents the last used gamepad
export class ActiveXRGamepad extends Group {

	get connected() {

		return this.activeController.connected;

	}

	get selectPressed() {

		return this.activeController.selectPressed;

	}

	get squeezePressed() {

		return this.activeController.squeezePressed;

	}

	constructor( controllers ) {

		super();

		this.controllers = controllers;
		this.activeController = controllers[ 0 ];
		this.disposeCallbacks = [];

		const disposeCallbacks = this.disposeCallbacks;
		for ( let i = 0, l = controllers.length; i < l; i ++ ) {

			const controller = controllers[ i ];

			const forwardCallback = e => {

				if ( controller === this.activeController ) {

					this.dispatchEvent( e );

				}

			};
			const checkActiveCallback = e => {

				if ( this.activeController !== controller ) {

					this.activeController = controller;

				} else {

					forwardCallback( e );

				}

			};

			controller.addEventListener( 'connected', forwardCallback );
			controller.addEventListener( 'disconnected', forwardCallback );

			controller.addEventListener( 'pressed', checkActiveCallback );
			controller.addEventListener( 'released', checkActiveCallback );
			controller.addEventListener( 'axis-pressed', checkActiveCallback );
			controller.addEventListener( 'axis-released', checkActiveCallback );
			controller.addEventListener( 'selectstart', checkActiveCallback );
			controller.addEventListener( 'selectend', checkActiveCallback );
			controller.addEventListener( 'squeezestart', checkActiveCallback );
			controller.addEventListener( 'squeezeend', checkActiveCallback );

			disposeCallbacks.push( () => {

				controller.removeEventListener( 'connected', forwardCallback );
				controller.removeEventListener( 'disconnected', forwardCallback );

				controller.removeEventListener( 'pressed', checkActiveCallback );
				controller.removeEventListener( 'released', checkActiveCallback );
				controller.removeEventListener( 'axis-pressed', checkActiveCallback );
				controller.removeEventListener( 'axis-released', checkActiveCallback );
				controller.removeEventListener( 'selectstart', checkActiveCallback );
				controller.removeEventListener( 'selectend', checkActiveCallback );
				controller.removeEventListener( 'squeezestart', checkActiveCallback );
				controller.removeEventListener( 'squeezeend', checkActiveCallback );

			} );

		}

	}

	update( updateSourceControllers = true ) {

		const { activeController, controllers } = this;
		if ( updateSourceControllers ) {

			controllers.forEach( c => {

				c.update();

			} );

		}

		this.position.copy( activeController.position );
		this.quaternion.copy( activeController.quaternion );
		this.scale.copy( activeController.scale );

	}

	getAxis( name ) {

		return this.activeController.getAxis( name );

	}

	getButtonValue( name ) {

		return this.activeController.getButtonValue( name );

	}

	getButtonHeld( name ) {

		return this.activeController.getButtonHeld( name );

	}

	getButtonPressed( name ) {

		return this.activeController.getButtonPressed( name );

	}

	dispose() {

		this.disposeCallbacks.forEach( cb => cb() );

	}

}
