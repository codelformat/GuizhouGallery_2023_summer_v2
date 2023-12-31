import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { A, D, DIRECTIONS, S, V, W } from './utils'
import { Octree } from 'three/examples/jsm/math/Octree.js';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';


export class CharacterControls {

    scene: THREE.Scene
    model: THREE.Group
    // character: THREE.Object3D
    collider: THREE.Mesh
    mixer: THREE.AnimationMixer
    animationsMap: Map<string, THREE.AnimationAction> = new Map() // Walk, Run, Idle
    orbitControl: OrbitControls
    camera: THREE.PerspectiveCamera
    worldOctree: Octree
    playerCollider: Capsule
    collisionObjects: THREE.Mesh[] = [];
    arrowHelper: THREE.ArrowHelper = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 1, 0xff0000)

    // state
    toggleRun: boolean = true
    playerOnFloor: boolean = false
    isFirstPersonView: boolean = false
    currentAction: string
    playerDirection: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
    playerVelocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0)

    // Raycaster
    raycaster = new THREE.Raycaster();
    private camera_raycaster: THREE.Raycaster = new THREE.Raycaster();

    // temporary data
    walkDirection = new THREE.Vector3()
    rotateAngle = new THREE.Vector3(0, 1, 0)
    rotateQuarternion: THREE.Quaternion = new THREE.Quaternion()
    cameraTarget = new THREE.Vector3()

    // constants
    fadeDuration: number = 0.2
    runVelocity = 5
    walkVelocity = 2
    GRAVITY = 9.8

    constructor(scene: THREE.Scene, model: THREE.Group,
        mixer: THREE.AnimationMixer, animationsMap: Map<string, THREE.AnimationAction>,
        orbitControl: OrbitControls, camera: THREE.PerspectiveCamera, worldOctree: Octree, playerCollider: Capsule, collision_objects: THREE.Mesh[],
        currentAction: string) {
        this.scene = scene
        this.model = model
        this.mixer = mixer
        this.animationsMap = animationsMap
        this.currentAction = currentAction
        this.animationsMap.forEach((value, key) => {
            if (key == currentAction) {
                value.play()
            }
        })
        this.orbitControl = orbitControl
        this.camera = camera
        this.updateCameraTarget(0, 0)

        this.worldOctree = worldOctree
        this.playerCollider = playerCollider
        this.collisionObjects = collision_objects;

        //this.arrowHelper.position.copy(this.playerCollider.start);
        //this.arrowHelper.setLength(1);
        //this.arrowHelper.
        //this.scene.add(this.arrowHelper);
        this.raycaster.set(this.playerCollider.start, new THREE.Vector3(0, -1, 0));
        this.raycaster.far = 1.5;
        this.raycaster.near = 0.1;
        this.camera_raycaster.far = 5;

        const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1.8, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        this.collider = new THREE.Mesh(geometry, material);
        this.collider.position.copy(this.playerCollider.end.add(this.playerCollider.start).multiplyScalar(0.5));
        this.orbitControl.minDistance = 1;
        this.orbitControl.maxDistance = 5;
    }

    public switchRunToggle() {
        this.toggleRun = !this.toggleRun
    }

    public update(delta: number, keysPressed: any, isFirstPersonView: boolean) {
        // Animation Controls
        if(isFirstPersonView) {
            this.orbitControl.minDistance = 1e-4;
            this.orbitControl.maxDistance = 1e-4;
        }
        else {
            this.orbitControl.minDistance = 1;
            this.orbitControl.maxDistance = 2;
        }
        const directionPressed = DIRECTIONS.some(key => keysPressed[key] == true)

        var play = '';
        if (directionPressed && this.toggleRun) {
            play = 'Run'
        } else if (directionPressed) {
            play = 'Walk'
        } else {
            play = 'Idle'
        }

        if (this.currentAction != play) {
            const toPlay = this.animationsMap.get(play)
            const current = this.animationsMap.get(this.currentAction)

            current.fadeOut(this.fadeDuration)
            toPlay.reset().fadeIn(this.fadeDuration).play();

            this.currentAction = play
        }

        this.mixer.update(delta)

        // Camera Controls
        if (this.currentAction == 'Run' || this.currentAction == 'Walk') {
            // calculate towards camera direction
            var angleYCameraDirection = Math.atan2(
                (this.camera.position.x - this.model.position.x),
                (this.camera.position.z - this.model.position.z))
            // diagonal movement angle offset
            var directionOffset = this.directionOffset(keysPressed)

            // rotate model
            this.rotateQuarternion.setFromAxisAngle(this.rotateAngle, angleYCameraDirection + directionOffset)
            const quaternion_helper = this.model.quaternion.clone();
            quaternion_helper.rotateTowards(this.rotateQuarternion, 0.4)
            this.model.quaternion.slerp(quaternion_helper, 0.6);

            // calculate direction
            this.camera.getWorldDirection(this.walkDirection)

            this.walkDirection.y = 0

            this.walkDirection.normalize()
            this.walkDirection.applyAxisAngle(this.rotateAngle, directionOffset)
            // console.log(this.walkDirection);

            const speedDelta = delta *  (play === 'run' ? 36 : 25);

            this.playerVelocity.add(this.walkDirection.multiplyScalar(speedDelta));
            // run/walk velocity

            let damping = Math.exp(- 4 * delta) - 1;

            if (!this.playerOnFloor) {

                this.playerVelocity.y -= this.GRAVITY * delta;

                // small air resistance
                damping *= 0.1;

            }

            this.playerVelocity.addScaledVector(this.playerVelocity, damping);

            const deltaPosition = this.playerVelocity.clone().multiplyScalar(delta);
            this.playerCollider.translate(deltaPosition);


            this.model.position.copy(this.playerCollider.start);

            this.playerCollisions();
            // this._checkCameraCollision(this.collisionObjects, isFirstPersonView);


            this.updateCameraTarget(deltaPosition.x, deltaPosition.z);
            
        }
    }

    private playerCollisions() {
        const result = this.worldOctree.capsuleIntersect(this.playerCollider);

        this.playerOnFloor = false;
        if (result) {
            this.playerOnFloor = result.normal.y > 0;
            // console.log(result.normal);

            if (!this.playerOnFloor) {
                this.playerVelocity.addScaledVector(result.normal, - result.normal.dot(this.playerVelocity));
            }

            this.playerCollider.translate(result.normal.multiplyScalar(result.depth));
            //
            this.model.position.copy(new THREE.Vector3(this.playerCollider.start.x, this.playerCollider.start.y, this.playerCollider.start.z));
            this.collider.position.copy(new THREE.Vector3(this.playerCollider.start.x, this.playerCollider.start.y, this.playerCollider.start.z));
            // // this.model.position.y -= 0.35;
        }
    }

    private _checkCameraCollision(colliders: THREE.Object3D[], is_first_person: boolean) {
		if (!is_first_person) {
			const ray_direction = new THREE.Vector3();
			ray_direction.subVectors(this.camera.position, this.model.position).normalize();
			this.camera_raycaster.set(this.model.position, ray_direction);
			const intersects = this.camera_raycaster.intersectObjects(colliders);
			if (intersects.length) {
				// 找到碰撞点后还需要往前偏移一点，不然还是可能会看到穿模
				const offset = new THREE.Vector3(); // 定义一个向前移动的偏移量
				offset.copy(ray_direction).multiplyScalar(-0.5); // 计算偏移量，这里的distance是想要向前移动的距离
				const new_position = new THREE.Vector3().addVectors(intersects[0].point, offset); // 计算新的相机位置
				this.camera.position.copy(new_position);

				this.orbitControl.minDistance = 0;
			} else {
				this.orbitControl.minDistance = 2;
			}
		}
	}

    private updateCameraTarget(moveX: number, moveZ: number) {
        
        // move camera
        this.camera.position.sub(this.orbitControl.target);
        this.cameraTarget.x = this.model.position.x
        this.cameraTarget.y = this.model.position.y + 1.5
        this.cameraTarget.z = this.model.position.z
        this.orbitControl.target = this.cameraTarget
        this.orbitControl.target.copy(this.cameraTarget);
        this.camera.position.add(this.model.position);
    }

    private directionOffset(keysPressed: any) {
        var directionOffset = 0 // w

        if (keysPressed[W]) {
            if (keysPressed[A]) {
                directionOffset = Math.PI / 4 // w+a
            } else if (keysPressed[D]) {
                directionOffset = - Math.PI / 4 // w+d
            }
        } else if (keysPressed[S]) {
            if (keysPressed[A]) {
                directionOffset = Math.PI / 4 + Math.PI / 2 // s+a
            } else if (keysPressed[D]) {
                directionOffset = -Math.PI / 4 - Math.PI / 2 // s+d
            } else {
                directionOffset = Math.PI // s
            }
        } else if (keysPressed[A]) {
            directionOffset = Math.PI / 2 // a
        } else if (keysPressed[D]) {
            directionOffset = - Math.PI / 2 // d
        }

        return directionOffset
    }
}