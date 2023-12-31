import * as THREE from 'three';
import * as dat from 'dat.gui';
import { CharacterControls } from './characterControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Octree } from 'three/examples/jsm/math/Octree.js';
import { OctreeHelper } from 'three/addons/helpers/OctreeHelper.js';
// import { OctreeHelper } from 'three/examples/jsm/helpers/OctreeHelper.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { RectAreaLightHelper } from 'three/examples/jsm/helpers/RectAreaLightHelper.js';
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader"
import { S } from './utils';
// import 'regenerator-runtime/runtime';


// console.log(Ammo);
/**
 * Constraints
 */
const numOfPoints = 23;
const DOCUMENTARY_INDEX = 23;
const DOCUMENTARY_VIDEO_INDEX = 0;

/**
 * Scene
 */
const scene = new THREE.Scene();

/**
 * Canvas
 */
const canvas = document.querySelector('canvas.webgl');

/**
 * Base Settings
 */
const clock = new THREE.Clock();

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(75,
	window.innerWidth / window.innerHeight,
	0.01,
	100
);
camera.rotation.order = 'YXZ';
camera.position.set(-2.624, 1.9, -8.46);

/**
 * Loaders
 */

let sceneReady = false;
const loadingBarElement = document.getElementById('loading-bar');
const loadingBarContainer = document.querySelector('.loading-bar-container');
const loadingManager = new THREE.LoadingManager();
loadingManager.onStart = (url, item, total) => {
	console.log('Started loading file: ' + url + '.\nLoaded ' + item + ' of ' + total + ' files.');
}

loadingManager.onProgress = (url, loaded, total) => {
	console.log('Loading file: ' + url + '.\nLoaded ' + loaded + ' of ' + total + ' files.');
	loadingBarElement.value = (loaded / total) * 100;
}

loadingManager.onLoad = () => {
	loadingBarContainer.classList.add("fade-out");
	window.setTimeout(() => {
		loadingBarContainer.style.display = 'none';
	}, 2000);

	sceneReady = true;
};

const gltfLoader = new GLTFLoader(loadingManager);
const fbxLoader = new FBXLoader(loadingManager);
const rgbeLoader = new RGBELoader(loadingManager);

/**
 * Sizes
 */
const sizes = {
	width: window.innerWidth,
	height: window.innerHeight,
};

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas, powerPreference: "high-performance" });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.useLegacyLights = false;

/**
 * Player Settings
 */
const worldOctree = new Octree();

const playerCollider = new Capsule(new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0, 2.15, 0), 0.5);
playerCollider.translate(new THREE.Vector3(0.5, 0, -8.55));

const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();

let playerOnFloor = false;
let mouseTime = 0;

/**
 * Octree Helper
 */




/**
 * Panorama Environment & Background
 */
rgbeLoader.loadAsync('/imgs/alps_field_4k.hdr').then((texture) => {
	texture.mapping = THREE.EquirectangularReflectionMapping;
	scene.environment = texture;
	scene.background = texture;
});

/**
 * Points for interations
 */
interface Point {
	position: THREE.Vector3;
	element: HTMLElement;
}
const points: Point[] = [];

for (let i = 0; i <= numOfPoints; i++) {
	const point = {
		position: new THREE.Vector3(0, 0, 0),
		element: document.querySelector(`.point-${i}`)
	};
	points.push(point);
}

/**
 * Objects for raycast
 */
const raycast_objects: THREE.Object3D[] = [];

/**
 * Model Loader
 */
gltfLoader.setPath('/models/');
gltfLoader.load('展馆v1.2-5m层高-v2.3竖画.glb', (gltf) => {
	scene.add(gltf.scene);

	worldOctree.fromGraphNode(gltf.scene);

	gltf.scene.traverse((child) => {
		if (child.isMesh) {
			child.castShadow = true;
			child.receiveShadow = true;

			if (child.material.map) {
				child.material.map.anisotropy = 4;
			}
		}
		// console.log(child);

		if (child.name === "玻璃幕墙1" || child.name === "玻璃幕墙2" || child.name === "玻璃幕墙3" || child.name === "玻璃幕墙4" || child.name === "玻璃幕墙5"
			|| child.name === "玻璃幕墙6" || child.name === "玻璃幕墙7" || child.name === "玻璃幕墙8" || child.name === '立方体'
			|| child.name === "上楼墙" || child.name === "下楼墙" || child.name === "立方体.002") {

			child.material = glassMaterial;
			// console.log(child);
		}
		else if (child.name === '2F地板') {
			console.log(child);
			child.material = jadeMarbleMaterial;
		}
		else if (child.name === "2F墙1"
			|| child.name === "2F墙2" || child.name === "2F墙3" || child.name === "2F墙4" || child.name === "2F墙5" || child.name === "2F墙6"
			|| child.name === "2F墙7" || child.name === "2F墙8" || child.name === "2F墙9" || child.name === "2F墙10" || child.name === "2F墙11") {
			child.material = stoneMarbleMaterial;
		}
		else if (child.name === "蜡染展台1" || child.name === "蜡染展台2" || child.name === "蜡染展台3") {
			child.material = blueGlassMaterial;
		}
		else if (child.name[0] === '竖') {
			child.material = dragonMaterial;

			const match = child.name.match(/\d+/); // Extracts one or more digits from the name
			if (match) {
				const pointIndex = Number(match[0]);
				if (points[pointIndex]) {
					// console.log(pointIndex);
					points[pointIndex].position = child.position;
				}

				raycast_objects.push(child);
			}

			points[23].position = videoPlane.position;
			raycast_objects.push(videoPlane);
		}
	});

	const helper = new OctreeHelper(worldOctree);
	helper.visible = false;
	scene.add(helper);

	const octreeHelperFolder = gui.addFolder('Octree Helper');
	octreeHelperFolder.add({ debug: false }, 'debug')
		.onChange(function (value) {

			helper.visible = value;

		});

	animate();
});

// console.log(points);

/**
 * Characters
 */

/**
 * Axes Helper
 */
const axesHelper = new THREE.AxesHelper(100);
scene.add(axesHelper);

/**
 * Lights
 */
const rectWidth: Number = 3.5;
const rectHeight: Number = 0.5;
const rectIntensity: Number = 0;

const rectLights: THREE.RectAreaLight[] = [];
const rectLightHelpers: THREE.RectAreaLightHelper[] = [];
for (let i = 0; i < 10; i++) {
	const rectLight = new THREE.RectAreaLight(0xffffff, rectIntensity, rectWidth, rectHeight);
	rectLight.position.set(15.05, 7.5, -2.05);
	rectLight.rotation.x = 0;
	rectLight.rotation.y = 1.57;
	rectLight.rotation.z = 0;

	rectLights.push(rectLight);
	scene.add(rectLight)

	const rectLightHelper = new RectAreaLightHelper(rectLight);
	rectLightHelpers.push(rectLightHelper);
	scene.add(rectLightHelper);
}

rectLights[0].position.set(10.2, 7.5, -4.7);
rectLights[0].width = 4;
rectLights[0].rotation.x = -0.7;
rectLights[0].intensity = 1.2;

/**
 * Points of interest
 */
const raycaster = new THREE.Raycaster()
raycaster.far = 25;
raycaster.near = 0.1;



/**
 * Textures & Materials
 */

/**
 *  Glass material
 */
const glassMaterial = new THREE.MeshPhysicalMaterial({
	color: 0xffffff,
	transparent: true,
	opacity: 0.6,
	roughness: 0.1,
	metalness: 0.1,
	envMapIntensity: 0.5,
	transmission: 1,
	// clearcoat: 0.01,
	// clearcoatRoughness: 0.4,
	refractionRatio: 1.5,
});

/**
 *  Blue Glass material
 */
const blueGlassMaterial = new THREE.MeshPhysicalMaterial({
	color: 0x87cefa,
	transparent: true,
	opacity: 0.8,
	roughness: 0,
	metalness: 0.4,
	envMapIntensity: 0.5,
	transmission: 0.6,
	clearcoat: 0.1,
	clearcoatRoughness: 0.4,
	refractionRatio: 1.5,
});

const textureLoader = new THREE.TextureLoader(loadingManager);
textureLoader.setPath('/textures/');

/**
 * Dragon Painting Texture
 */
const dragonColorTexture = textureLoader.load('dragon_Model_5_u1_v1_diffuse_2.png');
const dragonNormalTexture = textureLoader.load('dragon_Model_5_u1_v1_normal.png');
const dragonMaterial = new THREE.MeshPhysicalMaterial({
	map: dragonColorTexture,
	normalMap: dragonNormalTexture,
	side: THREE.FrontSide,
	envMapIntensity: 0.1,
	// roughness: 0.4,
});

/**
 * Jade Marble Texture
 */


const jadeMarbleColorTexture = textureLoader.load('MarbleJadeBamboo001_COL_4K_METALNESS.png');
// jadeMarbleColorTexture.repeat.set(2, 2);
jadeMarbleColorTexture.wrapS = THREE.MirroredRepeatWrapping;
jadeMarbleColorTexture.wrapT = THREE.RepeatWrapping;
const jadeMarbleAlphaTexture = textureLoader.load('MarbleJadeBamboo001_MASK_4K_METALNESS.png');
const jadeMarbleNormalTexture = textureLoader.load('MarbleJadeBamboo001_NRM_4K_METALNESS.png');
const jadeMarbleRoughnessTexture = textureLoader.load('MarbleJadeBamboo001_ROUGHNESS_4K_METALNESS.png');
const jadeMarbleMetalnessTexture = textureLoader.load('MarbleJadeBamboo001_METALNESS_4K_METALNESS.png');
const jadeMarbleMaterial = new THREE.MeshPhysicalMaterial({
	map: jadeMarbleColorTexture,
	alphaMap: jadeMarbleAlphaTexture,
	normalMap: jadeMarbleNormalTexture,
	roughnessMap: jadeMarbleRoughnessTexture,
	metalnessMap: jadeMarbleMetalnessTexture,
	side: THREE.FrontSide
});

/**
 * 2F Stone Marble Wall Material
 */
const stoneMarbleColorTexture = textureLoader.load("pkcnJ_4K_Albedo.jpg");
const stoneMarbleNormalTexture = textureLoader.load("pkcnJ_4K_Normal.jpg");
const stoneMarbleRoughnessTexture = textureLoader.load("pkcnJ_4K_Roughness.jpg");
const stoneMarbleAOTexture = textureLoader.load("pkcnJ_4K_AO.jpg");
const stoneMarbleDisplacementTexture = textureLoader.load("pkcnJ_4K_Displacement.jpg");
const stoneMarbleMaterial = new THREE.MeshPhysicalMaterial({
	map: stoneMarbleColorTexture,
	normalMap: stoneMarbleNormalTexture,
	roughnessMap: stoneMarbleRoughnessTexture,
	aoMap: stoneMarbleAOTexture,
	//displacementMap: stoneMarbleDisplacementTexture,

	envMapIntensity: 0.4,
	side: THREE.DoubleSide
});

/**
 * 1F Documentary Video Materials
 */
const videos = [
	{
		video: document.createElement('video'),
		source: '/videos/documentary_compressed.mp4',
	}
];
const videoTextures = [];
const videoMaterials = [];
let videoPlayFlag = false;

for (const video of videos) {
	video.video.src = video.source;
	video.video.loop = false;
	video.video.muted = false;
	video.video.load();
	//video.video.autoplay = true;
	//video.video.play();


	videoTextures.push(new THREE.VideoTexture(video.video));
	videoMaterials.push(new THREE.MeshBasicMaterial({ map: videoTextures[videoTextures.length - 1] }));
}

// Step 4: Listen for Video End Event
videos[DOCUMENTARY_VIDEO_INDEX].video.addEventListener('ended', () => {
	// Step 5: Update Object Opacity
	let opacity = 1;
	const fadeOutInterval = setInterval(() => {
		opacity -= 0.01; // Adjust the fading rate as needed
		videoPlane.material.opacity = opacity;
		if (opacity <= 0) {
			clearInterval(fadeOutInterval);
			scene.remove(videoPlane); // Optionally remove the object from the scene
		}
	}, 100); // Interval duration for fading
});





/**
 * Dragon Painting Plane
 */
const dragonPaintingPlane = new THREE.Mesh(
	new THREE.PlaneGeometry(35, 9.5),
	dragonMaterial
);
dragonPaintingPlane.position.set(12.8, 7, -5.65);
dragonPaintingPlane.scale.set(0.15, 0.15, 1);
dragonPaintingPlane.rotation.y = -0.65;
scene.add(dragonPaintingPlane);

/**
 * Video Plane
 */

const videoPlane = new THREE.Mesh(
	new THREE.PlaneGeometry(16, 9),
	videoMaterials[0]
);
videoPlane.position.set(15.05, 1.49, -9.58);
videoPlane.rotation.y = -1.57;
videoPlane.scale.set(0.32, 0.32, 1);
scene.add(videoPlane);

/**
 * Physics Settings
 */
const STEPS_PER_FRAME = 5;
const GRAVITY = 30;



const keyStates = {}; // Key State Array
/** 
 * Control keys
 */
// CONTROL KEYS
const keysPressed = {};

const vector1 = new THREE.Vector3();
const vector2 = new THREE.Vector3();
const vector3 = new THREE.Vector3();

document.addEventListener('keydown', (event) => {

	keyStates[event.code] = true;

});

document.addEventListener('keyup', (event) => {

	keyStates[event.code] = false;

});

document.addEventListener('mousedown', () => {

	document.body.requestPointerLock();

	mouseTime = performance.now();

});

// document.addEventListener('mouseup', () => {

// 	if (document.pointerLockElement !== null) // throwBall();

// });

document.body.addEventListener('mousemove', (event) => {

	if (document.pointerLockElement === document.body) {

		camera.rotation.y -= event.movementX / 500;
		camera.rotation.x -= event.movementY / 500;

	}

});
// Resize Window
window.addEventListener('resize', onWindowResize);
function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(window.innerWidth, window.innerHeight);
}

function playerCollisions() {

	const result = worldOctree.capsuleIntersect(playerCollider);

	playerOnFloor = false;

	if (result) {

		playerOnFloor = result.normal.y > 0;

		if (!playerOnFloor) {

			playerVelocity.addScaledVector(result.normal, - result.normal.dot(playerVelocity));

		}

		playerCollider.translate(result.normal.multiplyScalar(result.depth));

	}

}

function updatePlayer(deltaTime) {

	let damping = Math.exp(- 4 * deltaTime) - 1;

	if (!playerOnFloor) {

		playerVelocity.y -= GRAVITY * deltaTime;

		// small air resistance
		damping *= 0.1;

	}

	playerVelocity.addScaledVector(playerVelocity, damping);

	const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);
	playerCollider.translate(deltaPosition);

	playerCollisions();

	camera.position.copy(playerCollider.end);

}

function getForwardVector() {

	camera.getWorldDirection(playerDirection);
	playerDirection.y = 0;
	playerDirection.normalize();

	return playerDirection;

}

function getSideVector() {

	camera.getWorldDirection(playerDirection);
	playerDirection.y = 0;
	playerDirection.normalize();
	playerDirection.cross(camera.up);

	return playerDirection;

}

function controls(deltaTime) {

	// gives a bit of air control
	const speedDelta = deltaTime * (playerOnFloor ? 10 : 4);

	if (keyStates['KeyW']) {

		playerVelocity.add(getForwardVector().multiplyScalar(speedDelta));

	}

	if (keyStates['KeyS']) {

		playerVelocity.add(getForwardVector().multiplyScalar(- speedDelta));

	}

	if (keyStates['KeyA']) {

		playerVelocity.add(getSideVector().multiplyScalar(- speedDelta));

	}

	if (keyStates['KeyD']) {

		playerVelocity.add(getSideVector().multiplyScalar(speedDelta));

	}

	if (playerOnFloor) {

		if (keyStates['Space']) {

			playerVelocity.y = 15;

		}

	}
}

function teleportPlayerIfOob() {

	if (camera.position.y <= - 25) {

		playerCollider.start.set(0, 0.35, 0);
		playerCollider.end.set(0, 1, 0);
		playerCollider.radius = 0.35;
		camera.position.copy(playerCollider.end);
		camera.rotation.set(0, 0, 0);

	}

}

/**
 * dat.GUI Panel Controller
 */
const gui = new dat.GUI();

let index = 1;
for (const rectLight of rectLights) {
	let rectLightFolder = gui.addFolder('RectLight ' + index++);
	rectLightFolder.add(rectLight.position, 'x').min(-100).max(100).step(0.01).name('x');
	rectLightFolder.add(rectLight.position, 'y').min(-100).max(100).step(0.01).name('y');
	rectLightFolder.add(rectLight.position, 'z').min(-20).max(20).step(0.01).name('z');
	rectLightFolder.add(rectLight, 'height').min(0).max(20).step(0.01).name('height');
	rectLightFolder.add(rectLight, 'width').min(0).max(20).step(0.01).name('width');
	rectLightFolder.add(rectLight, 'intensity').min(0).max(200).step(0.01).name('intensity');
	rectLightFolder.add(rectLight.rotation, 'x').min(-Math.PI).max(Math.PI).step(0.01).name('rotateX');
	rectLightFolder.add(rectLight.rotation, 'y').min(-Math.PI).max(Math.PI).step(0.01).name('rotateY');
	rectLightFolder.add(rectLight.rotation, 'z').min(-Math.PI).max(Math.PI).step(0.01).name('rotateZ');
}

let dragonFolder = gui.addFolder('Dragon Painting Plane');
dragonFolder.add(dragonPaintingPlane.position, 'x').min(-100).max(100).step(0.01).name('x');
dragonFolder.add(dragonPaintingPlane.position, 'y').min(-100).max(100).step(0.01).name('y');
dragonFolder.add(dragonPaintingPlane.position, 'z').min(-100).max(100).step(0.01).name('z');
dragonFolder.add(dragonPaintingPlane.rotation, 'x').min(-Math.PI).max(Math.PI).step(0.01).name('rotateX');
dragonFolder.add(dragonPaintingPlane.rotation, 'y').min(-Math.PI).max(Math.PI).step(0.01).name('rotateY');
dragonFolder.add(dragonPaintingPlane.rotation, 'z').min(-Math.PI).max(Math.PI).step(0.01).name('rotateZ');
dragonFolder.add(dragonPaintingPlane.scale, 'x').min(-20).max(10).step(0.01).name('scaleX');
dragonFolder.add(dragonPaintingPlane.scale, 'y').min(-20).max(10).step(0.01).name('scaleY');

let documentaryFolder = gui.addFolder('Documentary Video Plane');
documentaryFolder.add(videoPlane.position, 'x').min(0).max(30).step(0.002).name('x');
documentaryFolder.add(videoPlane.position, 'y').min(0).max(30).step(0.002).name('y');
documentaryFolder.add(videoPlane.position, 'z').min(-20).max(0).step(0.002).name('z');
documentaryFolder.add(videoPlane.rotation, 'x').min(-Math.PI).max(Math.PI).step(0.01).name('rotateX');
documentaryFolder.add(videoPlane.rotation, 'y').min(-Math.PI).max(Math.PI).step(0.01).name('rotateY');
documentaryFolder.add(videoPlane.rotation, 'z').min(-Math.PI).max(Math.PI).step(0.01).name('rotateZ');
documentaryFolder.add(videoPlane.scale, 'x').min(0).max(1).step(0.01).name('scaleX');
documentaryFolder.add(videoPlane.scale, 'y').min(0).max(1).step(0.01).name('scaleY');


/**
 * Functions
 */

/**
 * Interation
 */
const timeStep = 1 / 60;
const hover_point = new THREE.Vector2(0, 0);
let match_index: any;
let pointIndex: any = 0;

function paintingInteractions() {
	// Update points only when the scene is ready
	if (sceneReady) {

		// raycaster.setFromCamera(hover_point, camera);
		let rayDir = new THREE.Vector3(0, 0, 0);
		camera.getWorldDirection(rayDir);
		rayDir.y = 0;
		raycaster.set(camera.position, rayDir.normalize());

		const intersects = raycaster.intersectObjects(raycast_objects);
		// console.log(intersects);
		if (intersects.length) {
			if (intersects[0].object.name[0] === '竖') {
				match_index = intersects[0].object.name.match(/\d+/);

				pointIndex = Number(match_index[0]);
				points[pointIndex].element.classList.add('visible')
				videoPlayFlag = false;
			}
			else {
				pointIndex = DOCUMENTARY_INDEX;
				points[DOCUMENTARY_INDEX].element.classList.add('visible')
				videoPlayFlag = true;
			}
			for (let i = 0; i <= numOfPoints; i++) {
				if (i == pointIndex)
					continue;
				points[i].element.classList.remove('visible');
			}
		}

		// Intersect found
		else {
			points[pointIndex].element.classList.remove('visible')
		}

		// Get 2D screen position
		for (const point of points) {
			const screenPosition = point.position.clone()
			screenPosition.project(camera)
			const translateX = screenPosition.x * sizes.width * 0.5
			const translateY = - screenPosition.y * sizes.height * 0.5
			point.element.style.transform = `translateX(${translateX}px) translateY(${translateY}px)`
		}
	}
}


const videoRaycaster = new THREE.Raycaster();
let videoDirectionVector = new THREE.Vector3();
function videoInteractions() {

	let rayDir = new THREE.Vector3(0, 0, 0);
	camera.getWorldDirection(rayDir);
	rayDir.y = 0;
	videoRaycaster.set(camera.position, rayDir.normalize());

	const intersects = raycaster.intersectObject(videoPlane);
	// console.log(intersects);
	if (intersects.length) {

	}
}
function animate() {
	const deltaTime = Math.min(0.05, clock.getDelta() * 3) / STEPS_PER_FRAME;

	for (let i = 0; i < STEPS_PER_FRAME; i++) {

		controls(deltaTime);

		updatePlayer(deltaTime);

		teleportPlayerIfOob();
	}
	
	paintingInteractions();

	renderer.render(scene, camera);

	// console.log(camera.position)
	requestAnimationFrame(animate);
}

