// ...
// Based on 
// Created by Bjorn Sandvik - thematicmapping.org
(function () {

	var mapFiles = [
		'color_map_mgs_2k.jpg',
		'color_map_2k.jpg',
		'color_map_8k.jpg',
		'color_map_msss_labeled.jpg',
		'color_map_viking_reduced.jpg',
		'color_map_mgs_16k.jpg',
		'color_map_nasa_landing_sites.jpg',
		'color_map_mpf_planning.jpg',
		'color_map_aaas_labels.jpg',
		'color_map_terraformed.jpg',
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

	var camera = new THREE.PerspectiveCamera(10, width/height, 0.01, 50000);
	//var camera = new THREE.OrthographicCamera(-width/height, width/height, 1, -1, 0.01, 100);
	camera.position.z = 10;
	console.log(camera);

	var renderer = new THREE.WebGLRenderer();
	renderer.setSize(width, height);

	scene.add(new THREE.AmbientLight(0x222222));

	//var light = new THREE.DirectionalLight(0xffffff, 1);
	var light = new THREE.PointLight(0xffffff, 1, 1000, 1);
	light.position.set(0,0,60);
	camera.add(light);
	scene.add(camera);

    var sphere = createSphere(radius, segments);
	sphere.rotation.y = rotation; 
	scene.add(sphere)


	var stars = createStars(40000, 64);
	scene.add(stars);
	
	console.log(scene);

	var controls = new THREE.TrackballControls(camera, renderer.domElement);

	webglEl.appendChild(renderer.domElement);

	console.log(light);
	var gui = new dat.GUI();
	gui.add(light.position, 'x', -90, 90).listen().name("sun az");
	gui.add(light.position, 'y', -15, 15).listen().name("sun el");
	gui.add(sphere.rotation, 'y', 0, 6.2832).listen().name("planet rotation");
	gui.add(options, 'animate').listen();
	gui.add(options, 'mirror').listen().onChange(function(){reverseTexture()});
	gui.add(options, 'mapFile',mapFiles).listen().name("Base map").onChange(function(){changeMap()});
	gui.add(sphere.material, 'bumpScale',0,0.1).listen().name("texture scale");
	gui.add(sphere.material.color, 'r',0.6,1).listen().name("red");
	gui.add(sphere.material.color, 'g',0.6,1).listen().name("green");
	gui.add(sphere.material.color, 'b',0.6,1).listen().name("blue");
	
	render();

	function changeMap(){
		console.log("changing base map to: images/" + options.mapFile);
		sphere.material.map = THREE.ImageUtils.loadTexture('images/' + options.mapFile);
		
		if(options.mirror){
			reverseTexture();
		}
	}
	
	function reverseTexture(){
		console.log("mirror: " + options.mirror);
		// note: flipY is normally true;  mirrored is flipY=false
		sphere.material.map.flipY = !options.mirror;
		sphere.material.map.needsUpdate = true;
		sphere.material.bumpMap.flipY = !options.mirror;
		sphere.material.bumpMap.needsUpdate = true;
		sphere.rotation.z += Math.PI * (options.mirror ? 1 : -1);
		console.log(sphere);
	}

	function render() {
		controls.update();
		if(options.animate) {
			sphere.rotation.y += 0.0005;
		}
		requestAnimationFrame(render);
		renderer.render(scene, camera);
	}

	function createSphere(radius, segments) {
		console.log("making sphere");
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

	function createStars(radius, segments) {
		console.log("making stars");		
		var starTexture = new THREE.ImageUtils.loadTexture( 'images/starfield.jpg' );	
		starTexture.wrapS = THREE.RepeatWrapping;
		starTexture.wrapT = THREE.RepeatWrapping;
		starTexture.repeat.set(8,8);
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