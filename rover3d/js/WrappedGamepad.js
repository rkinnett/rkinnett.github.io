import {
	EventDispatcher,
} from './three.module.js';
import {
	getMappings,
} from './ButtonMappings.js';

const RELEASED = 0;
const HELD = 1;
const PRESSED = 2;
export class WrappedGamepad extends EventDispatcher {

	constructor( gamepad ) {

		super();

		this.buttonState = [];
		this.axesState = [];
		this.axisDeadZone = 0.1;
		this.axisPressThreshold = 0.5;
		this.buttonNames = null;
		this.buttonMappings = null;
		this.axisMappings = null;
		this.inverseButtonMappings = null;
		this.inverseAxisMappings = null;

		this.connected = false;
		this.gamepad = null;

		if ( gamepad ) {

			this.connect( gamepad );

		}

	}

	getAxisName( index ) {

		const { axisMappings } = this;
		if ( axisMappings ) {

			for ( const key in axisMappings ) {

				if ( index === axisMappings[ key ] ) return key;

			}

		}

		return index;

	}

	getButtonName( index ) {

		const { buttonNames } = this;
		if ( buttonNames ) {

			return index in buttonNames ? buttonNames[ index ] : index;

		}

		return index;

	}

	getAxis( name ) {

		if ( typeof name === 'number' ) {

			return this.axesState[ name ];

		} else if ( this.axisMappings ) {

			return this.axesState[ this.axisMappings[ name ] ] || 0.0;

		} else {

			return 0.0;

		}

	}

	getButtonState( name ) {

		if ( typeof name === 'number' ) {

			return this.buttonState[ name ];

		} else if ( this.buttonMappings ) {

			return this.buttonState[ this.buttonMappings[ name ] ] || RELEASED;

		} else {

			return RELEASED;

		}

	}

	getButtonHeld( name ) {

		return this.getButtonState( name ) >= HELD;

	}

	getButtonPressed( name ) {

		return this.getButtonState( name ) === PRESSED;

	}

	getButtonValue( name ) {

		let button = null;
		if ( typeof name === 'number' ) {

			button = this.gamepad.buttons[ name ];

		} else if ( this.buttonMappings ) {

			button = this.gamepad.buttons[ this.buttonMappings[ name ] ];

		}

		return button ? button.value : 0.0;

	}

	connect( gamepad ) {

		this.connected = true;
		this.gamepad = gamepad;
		this.buttonState = new Array( gamepad.buttons.length ).fill( RELEASED );
		this.axesState = new Array( gamepad.axes.length ).fill( 0 );

		const mapping = getMappings( gamepad.id, gamepad.mapping );
		if ( mapping ) {

			this.buttonMappings = mapping.buttons;
			this.axisMappings = mapping.axes;
			this.buttonNames = mapping.buttonNames;
			this.inverseButtonMappings = mapping.inverseButtons;
			this.inverseAxisMappings = mapping.inverseAxes;

		}
		this.dispatchEvent( 'connected' );

	}

	disconnect() {

		this.connected = false;
		this.gamepad = null;
		this.buttonState = [];
		this.axesState = [];
		this.buttonMappings = null;
		this.axisMappings = null;
		this.inverseAxisMappings = null;
		this.inverseButtonMappings = null;
		this.buttonNames = null;

		this.dispatchEvent( 'disconnected' );

	}


	update( gamepad = this.gamepad ) {

		if ( ! this.connected ) return;

		const {
			buttonState,
			inverseButtonMappings,
			axesState,
			inverseAxisMappings,
			axisDeadZone,
			axisPressThreshold,
		} = this;
		const { axes, buttons } = gamepad;

		for ( let i = 0, l = buttons.length; i < l; i ++ ) {

			const button = buttons[ i ];
			const isPressed = button.value > 0.5;

			const name = inverseButtonMappings ? inverseButtonMappings[ i ] || null : null;
			const state = buttonState[ i ];
			const value = button.value;
			if ( isPressed ) {

				if ( state === RELEASED ) {

					buttonState[ i ] = PRESSED;
					this.dispatchEvent( { type: 'pressed', button: i, name, value } );

				} else if ( state === PRESSED ) {

					buttonState[ i ] = HELD;

				}

			} else if ( state !== RELEASED ) {

				buttonState[ i ] = RELEASED;
				this.dispatchEvent( { type: 'released', button: i, name, value: 0.0 } );

			}

		}

		for ( let i = 0, l = axes.length; i < l; i ++ ) {

			const name = inverseAxisMappings ? inverseAxisMappings[ i ] || null : null;

			const prevValue = axesState[ i ];
			const value = axes[ i ];

			const absValue = Math.abs( value );
			const prevAbsValue = Math.abs( prevValue );

			axesState[ i ] = absValue < axisDeadZone ? 0.0 : axes[ i ];

			const isPressed = absValue > axisPressThreshold;
			const wasPressed = prevAbsValue > axisPressThreshold;
			if ( isPressed && ! wasPressed ) {

				this.dispatchEvent( { type: 'axis-pressed', axis: i, name, value } );

			} else if ( ! isPressed && wasPressed ) {

				this.dispatchEvent( { type: 'axis-released', axis: i, name, value: 0.0 } );

			}

		}

	}

}
