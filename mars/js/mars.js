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
		'albedo_1958.jpg',
		'albedo_antoniadi_1900.jpg',
		'albedo_map_mgs_tes.jpg',
		'albedo_map_mutch_1971.jpg',
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
		rotation = 6;  

	var options = {
		animate: false,
		mirror:  false,
		mapFile: 'color_map_mgs_2k.jpg',
	};


	var scene = new THREE.Scene();

	var camera = new THREE.PerspectiveCamera(15, width/height, 0.01, 500);
	camera.position.x = 7;
	console.log(camera);

	var renderer = new THREE.WebGLRenderer();
	renderer.setSize(width, height);

	scene.add(new THREE.AmbientLight(0x222222));

	//var light = new THREE.DirectionalLight(0xffffff, 1);
	var light = new THREE.PointLight(0xffffff, 1, 1000, 1);
	light.position.set(0,0,60);
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
	gui.add(options, 'mirror').listen().onChange(function(){
			reverseTexture(); 
			globe.rotation.z += Math.PI * (options.mirror ? 1 : -1);
			labels.rotation.z += Math.PI * (options.mirror ? 1 : -1);			
		});
	gui.add(labels.material, 'opacity',0,1).listen().name("labels opacity");
	gui.add(options, 'mapFile',mapFiles).listen().name("Base map").onChange(function(){changeMap()});
	gui.add(globe.material, 'bumpScale',0,0.1).listen().name("texture scale");
	gui.add(globe.material.color, 'r',0.6,1).listen().name("red");
	gui.add(globe.material.color, 'g',0.6,1).listen().name("green");
	gui.add(globe.material.color, 'b',0.6,1).listen().name("blue");
	gui.add(ephemQueryNowFcn,'add').name("Show now");
	gui.add(ephemQueryUtcFcn,'add').name("Show specific time");


	
	render();

	function showNow(){
		console.log("ephemQueryNowFcn");
		var dateQuery = new Date();
		console.log("Time now:  " + dateQuery);
		getEphem(dateQuery);
	}

	function showSpecificTime(){
		console.log("ephemQueryUtcFcn");
		var strResponse = window.prompt("UTC time  (YYYY-MM-DD HH:MM):");
		console.log("Time input dialog response:  " + strResponse);
		if(strResponse == null){
			console.log("empty response");
			return;
		}

		var dateQuery = new Date(strResponse + " Z") || 0;
		if(dateQuery>0){
			console.log("query time:  " + dateQuery.toISOString());
			getEphem(dateQuery);
		} else {
			console.log("error, invalid date");
		}
	}
	
	function getEphem(dateQuery){
		var strQueryDate = dateQuery.toISOString().substring(0,10);
		var dayFrac = (dateQuery.getTime()/1000/60/60/24) % 1;
		console.log(strQueryDate + ' ' + dayFrac*24 + ' hours');

		// round down to 1/4 day:
		var hourRoundedDown = Math.floor(dayFrac*4)*6;
		var strDateInterpBelow = strQueryDate + " " + (hourRoundedDown<10?"0":"") + hourRoundedDown + ":00";
		var interpRatio = (dayFrac*24 % 6) / 6;
		console.log("interp ratio: " + interpRatio);
		
		// get interp upper bound:
		var strDateInterpAbove = new Date(new Date(strDateInterpBelow + " Z").valueOf() + 6*60*60*1000).toISOString().substring(0,16).replace(/T/g, " ");
		console.log("interp bounds:  " + strDateInterpBelow + ", " + strDateInterpAbove);

		
		
		
		console.log("loading ephemeris file");	
		$.getJSON('js/ephem.json')
		.done(function(data) { 
			console.log("done"); 
			console.log(data["2020-01-01 06:00"][0]); // test
			var ephemBelow = data[strDateInterpBelow][0];
			var ephemAbove = data[strDateInterpAbove][0];
			var ObsSubLon = ephemBelow.ObsSubLon + interpRatio*(ephemAbove.ObsSubLon - ephemBelow.ObsSubLon + (ephemAbove.ObsSubLon<ephemBelow.ObsSubLon?360:0) );
			console.log(ephemBelow);
			console.log(ephemAbove);
			console.log(ObsSubLon);
			globe.rotation.y = labels.rotation.y = ObsSubLon*Math.PI/180;
			
			camera.position = new THREE.Vector3(7, 0, 0);
			// fixme: handle lookup errors
			// 			
			
		})
		.fail(function(jqXHR, textStatus, errorThrown) {
			console.log("error " + textStatus);
			console.log("incoming Text " + jqXHR.responseText);
		})
	}
	
	function renderEphemeris(ephemText){
		console.log("Received ephemeris:");
		console.log(ephemText);
	}


	function changeMap(){
		console.log("changing base map to: images/" + options.mapFile);
		globe.material.map = THREE.ImageUtils.loadTexture('images/' + options.mapFile);
		
		if(options.mirror){
			reverseTexture();
		}
	}
	
	function reverseTexture(){
		console.log("mirror: " + options.mirror);
		// note: flipY is normally true;  mirrored is flipY=false
		globe.material.map.flipY = !options.mirror;
		globe.material.map.needsUpdate = true;
		globe.material.bumpMap.flipY = !options.mirror;
		globe.material.bumpMap.needsUpdate = true;
		
		if(options.mirror){
			labels.material.map = THREE.ImageUtils.loadTexture('images/labels_inv.png');
		} else {
			labels.material.map = THREE.ImageUtils.loadTexture('images/labels.png');
		}
		labels.material.map.flipY = !options.mirror;
		labels.material.map.needsUpdate = true;	
	
	}

	function render() {
		controls.update();
		if(options.animate) {
			globe.rotation.y += 0.0005;
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
		//camera.left = width/height;
		//camera.right = -width/height;
		camera.updateProjectionMatrix();
		renderer.setSize( width, height );
	}

}());