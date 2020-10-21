// ...
// Based on 
// Created by Bjorn Sandvik - thematicmapping.org

(function () {

	var mapFiles = [
		'color_map_mgs_2k.jpg',
		'color_map_8k.jpg',
		'color_map_aaas_labels.jpg',
		'color_map_msss_labeled.jpg',
		'color_map_nasa_landing_sites.jpg',
		'color_map_viking_reduced.jpg',
		'color_map_mgs_hungarian.jpg',
		'color_map_mpf_planning.jpg',
		'color_map_peach_voltmer.jpg',
		'color_map_voltmer.jpg',
		'color_map_sujka.jpg',
		'albedo_1958.jpg',
		'albedo_antoniadi_1900.jpg',
		'albedo_map_mgs_tes.jpg',
		'albedo_map_mutch_1971.jpg',
		'topo_map_mola_machacek.jpg',
		'geology_mariner9.jpg',
		'hydrated_minerals_mex.jpg',
		'fantasy.jpg',
		'terraformed.jpg',	
	];


	var webglEl = document.getElementById('webgl');
	if (!Detector.webgl) {
		Detector.addGetWebGLMessage(webglEl);
		return;
	}

	window.addEventListener( 'resize', onWindowResize, false );

	var width  = document.documentElement.clientWidth,
		height = document.documentElement.clientHeight;

	// Globe params
	var radius   = 0.5,
		segments = 32,
		rotation = 0;  

	var options = {
		animate: false,
		mirror:  false,
		mapFile: 'color_map_mgs_2k.jpg',
		cameraDist: 7,
		sunPlaneDist: 60,
	};

	ephem = {
		loaded: false,
		data: null,
		ObsSubLat: null,
		ObsSubLon: null,
		SunSubLat: null,
		SunSubLon: null,
	}
	loadEphemData(true);


	scene = new THREE.Scene();

	var camera = new THREE.PerspectiveCamera(15, width/height, 0.01, 500);
	camera.position.x = options.cameraDist;
	console.log(camera);

	var renderer = new THREE.WebGLRenderer();
	renderer.setSize(width, height);

	scene.add(new THREE.AmbientLight(0x222222));

	var light = new THREE.PointLight(0xffffff, 1, 1000, 1);
	light.position.set(0,0,options.sunPlaneDist);
	camera.add(light);
	scene.add(camera);

    var globe = createGlobe(radius, segments);
	globe.rotation.y = rotation; 
	scene.add(globe);

    var labels = createLabels(radius*1.02, segments);
	labels.rotation.y = rotation;
	scene.add(labels);


	var stars = createStars(400, 64);
	scene.add(stars);
	console.log(scene);

	var controls = new THREE.TrackballControls(camera, renderer.domElement);

	webglEl.appendChild(renderer.domElement);

	var ephemQueryNowFcn = { add:function(){ showNow() }};
	var ephemQueryUtcFcn = { add:function(){ showSpecificTime()  }};


	var gui = new dat.GUI();
	gui.add(light.position, 'x', -90, 90).listen().name("sun az");
	gui.add(light.position, 'y', -15, 15).listen().name("sun el");
	gui.add(globe.rotation, 'y', 0, 6.2832).listen().name("planet rotation").onChange(function(val){labels.rotation.y=val});
	gui.add(options, 'animate').listen();
	gui.add(options, 'mirror').listen().onChange(function(boolMirror){ setMirroring(boolMirror) });
	gui.add(labels.material, 'opacity',0,1).listen().name("labels opacity");
	gui.add(options, 'mapFile',mapFiles).listen().name("Base map").onChange(function(){changeMap()});
	gui.add(globe.material, 'bumpScale',0,0.1).listen().name("texture scale");
	gui.add(globe.material.color, 'r',0.6,1).listen().name("red");
	gui.add(globe.material.color, 'g',0.6,1).listen().name("green");
	gui.add(globe.material.color, 'b',0.6,1).listen().name("blue");
	gui.add(ephemQueryNowFcn,'add').name("Show now");
	gui.add(ephemQueryUtcFcn,'add').name("Show specific time");
	//gui.add(camera.rotation, '


	render();






	function showNow(){
		console.log("ephemQueryNowFcn");
		var dateQuery = new Date();
		console.log("Time now:  " + dateQuery);
		renderTime(dateQuery);
	}

	function showSpecificTime(){
		console.log("ephemQueryUtcFcn");
		strResponse = window.prompt("UTC time  (YYYY-MM-DD HH:MM):");
		console.log("Time input dialog response:  " + strResponse);

		// handle empty response (cancel)
		if(strResponse == null){
			console.log("empty response");
			return;
		}

		// if received a response, then make sure user input meets required format:
		if(! (new RegExp('202[0-5]-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}').test(strResponse) )){
			alert("Error, invalid format");
			return;
		}
		
		// convert to date object:
		var dateQuery = new Date(strResponse.replace(' ','T') + ":00Z") || 0;
		if(dateQuery>0){
			console.log("query time:  " + dateQuery.toISOString());
			renderTime(dateQuery);
		} else {
			console.log("error, invalid date");
		}
	}
	
	function renderTime(dateQuery){
		var strQueryDate = dateQuery.toISOString().substring(0,10);
		var dayFrac = (dateQuery.getTime()/1000/60/60/24) % 1;
		console.log(strQueryDate + ' ' + dayFrac*24 + ' hours');

		// round down to 1/4 day:
		var hourRoundedDown = Math.floor(dayFrac*4)*6;
		var strDateInterpBelow = strQueryDate + " " + (hourRoundedDown<10?"0":"") + hourRoundedDown + ":00";
		console.log("strDateInterpBelow: " + strDateInterpBelow);
		var interpRatio = (dayFrac*24 % 6) / 6;
		console.log("interp ratio: " + interpRatio);
		
		// get interp upper bound:
		var strDateInterpAbove = new Date(new Date(strDateInterpBelow.replace(" ","T") + ":00Z").valueOf() + 6*60*60*1000).toISOString().substring(0,16).replace(/T/g, " ");
		console.log("interp bounds:  " + strDateInterpBelow + ", " + strDateInterpAbove);

		// get entries before and after query time:
		// fixme:  handle lookup errors
		var ephemBelow = ephem.data[strDateInterpBelow][0];
		console.log(ephemBelow);
		var ephemAbove = ephem.data[strDateInterpAbove][0];
		console.log(ephemAbove);
		
		// interpolate sub-observer longitude:
		ephem.ObsSubLon = (ephemBelow.ObsSubLon + interpRatio*(ephemAbove.ObsSubLon - ephemBelow.ObsSubLon + (ephemAbove.ObsSubLon<ephemBelow.ObsSubLon?360:0) ) ) % 360;
		
		// interpolate sub-observer latitude:
		ephem.ObsSubLat = (ephemBelow.ObsSubLat + interpRatio*(ephemAbove.ObsSubLat - ephemBelow.ObsSubLat));
		
		// interpolate sub-sun point
		ephem.SunSubLon = (ephemBelow.SunSubLon + interpRatio*(ephemAbove.SunSubLon - ephemBelow.SunSubLon + (ephemAbove.SunSubLon<ephemBelow.SunSubLon?360:0) )) % 360;
		ephem.SunSubLat = (ephemBelow.SunSubLat + interpRatio*(ephemAbove.SunSubLat - ephemBelow.SunSubLat));

		console.log("calculated ephemeris:");
		console.log(ephem);
		
		renderEphemeris();
	}

	function loadEphemData(boolShowNow){
		console.log("loading ephemeris file");
		$.getJSON('js/ephem.json')
		.done(function(data) { 
			console.log("done"); 
			ephem.data = data;
			console.log("testing ephem lookup:  ");
			console.log(data["2020-01-01 06:00"][0]); // test	
			ephem.loaded = true;
			if(boolShowNow) showNow();
		})
		.fail(function(jqXHR, textStatus, errorThrown) {
			console.log("error " + textStatus);
			console.log("incoming Text " + jqXHR.responseText);
		})
	}

	
	function renderEphemeris(){
		console.log("Rendering ephemeris");
		console.log(ephem);
		
		// interpolate sub-observer longitude and rotate Jupiter to point that toward camera:
		globe.rotation.y  = (ephem.ObsSubLon)*Math.PI/180;
		labels.rotation.y = ObsSubLon*Math.PI/180;
		
		// tilt camera to sub-observer lat/lon:
		camera.position = new THREE.Vector3(options.cameraDist*Math.cos(ephem.ObsSubLat*Math.PI/180), options.cameraDist*Math.sin(ephem.ObsSubLat*Math.PI/180), 0);
				
		// move light source (in camera frame) according to interpolated sun direction
		var deltaLonEarthSun = ephem.ObsSubLon - ephem.SunSubLon;
		console.log(deltaLonEarthSun);
		var deltaLatEarthSun = ephem.ObsSubLat - ephem.SunSubLat;
		console.log(deltaLatEarthSun);
		var camPosX = 2*options.sunPlaneDist*Math.sin(deltaLonEarthSun*Math.PI/180);
		console.log(camPosX);
		var camPosY = -2*options.sunPlaneDist*Math.sin(deltaLatEarthSun*Math.PI/180);
		console.log(camPosY);
		light.position.set(camPosX, camPosY, options.sunPlaneDist);
	}


	function changeMap(){
		console.log("changing base map to: images/" + options.mapFile);
		globe.material.map = THREE.ImageUtils.loadTexture('images/' + options.mapFile);
		
		if(options.mirror){
			reverseTexture();
		}
	}
	
	function setMirroring(boolMirror){
		if(boolMirror){
			labels.material.map = THREE.ImageUtils.loadTexture('images/labels_inv.png');
			webglEl.style.transform = "scaleX(-1)";
		} else {
			labels.material.map = THREE.ImageUtils.loadTexture('images/labels.png');
			webglEl.style.transform = "scaleX(1)";
		}
	}

	function render() {
		controls.update();
		if(options.animate) {
			globe.rotation.y += 0.0005;
			labels.rotation.y += 0.0005;
		}
		requestAnimationFrame(render);
		renderer.render(scene, camera);
	}

	function createGlobe(radius, segments) {
		console.log("making globe");
		return new THREE.Mesh(
			new THREE.SphereGeometry(radius, segments, segments),
			new THREE.MeshPhongMaterial({
				map:         THREE.ImageUtils.loadTexture('images/' + options.mapFile),
				bumpMap:     THREE.ImageUtils.loadTexture('images/mars_bump_map_4k_adj.jpg'),
				bumpScale:   0.01,
				side:        THREE.DoubleSide,
			})
		);
	}
	
	function createLabels(radius, segments) {
		console.log("making labels");
		return new THREE.Mesh(
			new THREE.SphereGeometry(radius, segments, segments),
			new THREE.MeshPhongMaterial({
				map:         THREE.ImageUtils.loadTexture('images/labels.png'),
				transparent: true,
				opacity:     0.5,
				side:        THREE.DoubleSide,
			})
		);
	}

	function createStars(radius, segments) {
		console.log("making stars");		
		var starTexture = new THREE.ImageUtils.loadTexture( 'images/starfield.jpg' );	
		starTexture.wrapS = THREE.RepeatWrapping;
		starTexture.wrapT = THREE.RepeatWrapping;
		starTexture.repeat.set(4,4);
		return new THREE.Mesh(
			new THREE.SphereGeometry(radius, segments, segments), 
			new THREE.MeshBasicMaterial({
				map:	starTexture,
				side: THREE.BackSide
			})
		);

	}


	function onWindowResize(){
		width = document.documentElement.clientWidth;
		height = document.documentElement.clientHeight;
		console.log("resizing to " + width + " x " + height + " px");
		camera.aspect = document.documentElement.clientWidth / document.documentElement.clientHeight;
		camera.updateProjectionMatrix();
		renderer.setSize( width, height );
	}

}());