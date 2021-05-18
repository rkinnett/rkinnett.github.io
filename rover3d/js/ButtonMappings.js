const xbox = {

	buttons: [
		'A', 'B', 'X', 'Y',
		'LBumper', 'RBumper', 'LTrigger', 'RTrigger',
		'Select', 'Start', 'LStick', 'RStick',
		'DUp', 'DDown', 'DLeft', 'DRight',
	],

	buttonNames: [
		'A', 'B', 'X', 'Y',
		'Left Bumper', 'Right Bumper', 'Left Trigger', 'Right Trigger',
		'Select', 'Start', 'Left Stick', 'Right Stick',
		'DPad Up', 'DPad Down', 'DPad Left', 'DPad Right',
	],

	axes: [
		'LStick-X', 'LStick-Y', 'RStick-X', 'RStick-Y',
	],

};

const playstation = {

	...xbox,

	buttonNames: [
		'Cross', 'Circle', 'X', 'Y',
		'L1', 'R1', 'L2', 'R2',
		'Select', 'Start', 'Left Stick', 'Right Stick',
		'DPad Up', 'DPad Down', 'DPad Left', 'DPad Right',
	],

};

const xrStandard = {

	buttons: [ 'Trigger', 'Squeeze', '', 'LStick', 'A', 'B' ],

	axes: [ '', '', 'LStick-X', 'LStick-Y' ],

	buttonNames: [ 'Trigger', 'Squeeze', '', 'Left Stick', 'A', 'B' ],

};

function mappingToObject( obj ) {

	const buttons = {};
	const inverseButtons = {};
	obj.buttons.forEach( ( name, index ) => buttons[ name ] = index );
	obj.buttons.forEach( ( name, index ) => inverseButtons[ index ] = name );

	const axes = {};
	const inverseAxes = {};
	obj.axes.forEach( ( name, index ) => axes[ name ] = index );
	obj.axes.forEach( ( name, index ) => inverseAxes[ index ] = name );

	return { buttons, inverseButtons, axes, inverseAxes, buttonNames: [ ...obj.buttonNames ] };

}

export function getMappings( id, mapping ) {

	if ( /xbox|xinput/i.test( id ) ) {

		return mappingToObject( xbox );

	}

	if ( /playstation/i.test( id ) ) {

		return mappingToObject( playstation );

	}

	if ( mapping === 'xr-standard' ) {

		return mappingToObject( xrStandard );

	}

	return null;

}
