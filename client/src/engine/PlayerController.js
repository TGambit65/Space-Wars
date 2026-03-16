/**
 * PlayerController — first-person character controller with PointerLock API.
 *
 * Handles WASD movement, mouse look, gravity, jumping, fly mode,
 * and axis-separated AABB collision detection against the voxel world.
 */

import * as THREE from 'three';
import { isSolid } from './BlockRegistry.js';

export class PlayerController {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {{ getBlock(wx: number, wy: number, wz: number): number }} chunkManager
   * @param {HTMLElement} domElement
   */
  constructor(camera, chunkManager, domElement) {
    this.camera = camera;
    this.chunkManager = chunkManager;
    this.domElement = domElement;

    // Spatial state
    this.position = new THREE.Vector3(0, 60, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);

    // Look angles
    this.yaw = 0;
    this.pitch = 0;

    // Input state
    this.moveState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      flyUp: false,
      flyDown: false,
    };

    // Physics flags
    this.isGrounded = false;
    this.flyMode = false;

    // Tuning constants
    this.speed = 4.3;          // blocks/sec
    this.sprintSpeed = 5.6;    // blocks/sec
    this.gravity = -20;        // blocks/sec^2
    this.jumpImpulse = 8;      // blocks/sec
    this.playerHeight = 1.7;   // metres
    this.playerWidth = 0.6;    // full width — half-extent is 0.3
    this.mouseSensitivity = 0.002;

    // PointerLock state
    this.isLocked = false;

    // Bound handlers (stored for cleanup)
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
    this._onClick = this._handleClick.bind(this);
    this._onPointerLockChange = this._handlePointerLockChange.bind(this);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Attach all event listeners. Call once after construction. */
  init() {
    this.domElement.addEventListener('click', this._onClick);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
  }

  /** Remove all event listeners. */
  dispose() {
    this.domElement.removeEventListener('click', this._onClick);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
  }

  // ---------------------------------------------------------------------------
  // Event handlers (private)
  // ---------------------------------------------------------------------------

  _handleClick() {
    if (!this.isLocked) {
      this.domElement.requestPointerLock();
    }
  }

  _handlePointerLockChange() {
    this.isLocked = document.pointerLockElement === this.domElement;
    if (!this.isLocked) {
      // Reset movement state so player doesn't keep drifting
      this.moveState.forward = false;
      this.moveState.backward = false;
      this.moveState.left = false;
      this.moveState.right = false;
      this.moveState.jump = false;
      this.moveState.sprint = false;
      this.moveState.flyUp = false;
      this.moveState.flyDown = false;
    }
  }

  _handleMouseMove(e) {
    if (!this.isLocked) return;

    this.yaw -= e.movementX * this.mouseSensitivity;
    this.pitch -= e.movementY * this.mouseSensitivity;

    // Clamp pitch to ~89 degrees
    const PITCH_LIMIT = Math.PI / 2 - 0.017; // 1.553 rad
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
  }

  _handleKeyDown(e) {
    if (!this.isLocked) return;
    this._setKeyState(e.code, true);
  }

  _handleKeyUp(e) {
    if (!this.isLocked) return;
    this._setKeyState(e.code, false);
  }

  /**
   * Map a keyboard code to the corresponding moveState flag.
   * @param {string} code - KeyboardEvent.code
   * @param {boolean} pressed
   */
  _setKeyState(code, pressed) {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveState.forward = pressed;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveState.backward = pressed;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.moveState.left = pressed;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveState.right = pressed;
        break;
      case 'Space':
        if (this.flyMode) {
          this.moveState.flyUp = pressed;
        } else {
          this.moveState.jump = pressed;
        }
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        if (this.flyMode) {
          this.moveState.flyDown = pressed;
        } else {
          this.moveState.sprint = pressed;
        }
        break;
      case 'KeyF':
        if (pressed) {
          this.flyMode = !this.flyMode;
          this.velocity.y = 0;
        }
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Physics / update
  // ---------------------------------------------------------------------------

  /**
   * Advance the player simulation by `dt` seconds.
   * @param {number} dt - delta time in seconds
   */
  update(dt) {
    // Clamp dt to avoid physics explosion after tab-away
    dt = Math.min(dt, 0.05);

    // ---- Build movement direction in the XZ plane ----
    const forward = new THREE.Vector3(
      -Math.sin(this.yaw),
      0,
      -Math.cos(this.yaw),
    );
    const right = new THREE.Vector3(
      Math.cos(this.yaw),
      0,
      -Math.sin(this.yaw),
    );

    const direction = new THREE.Vector3(0, 0, 0);
    if (this.moveState.forward)  direction.add(forward);
    if (this.moveState.backward) direction.sub(forward);
    if (this.moveState.left)     direction.sub(right);
    if (this.moveState.right)    direction.add(right);

    if (direction.lengthSq() > 0) {
      direction.normalize();
    }

    const currentSpeed = this.moveState.sprint ? this.sprintSpeed : this.speed;

    // ---- Compute velocity ----
    if (this.flyMode) {
      this.velocity.x = direction.x * currentSpeed;
      this.velocity.z = direction.z * currentSpeed;

      if (this.moveState.flyUp && this.moveState.flyDown) {
        this.velocity.y = 0;
      } else if (this.moveState.flyUp) {
        this.velocity.y = currentSpeed;
      } else if (this.moveState.flyDown) {
        this.velocity.y = -currentSpeed;
      } else {
        this.velocity.y = 0;
      }
    } else {
      this.velocity.x = direction.x * currentSpeed;
      this.velocity.z = direction.z * currentSpeed;

      // Gravity
      this.velocity.y += this.gravity * dt;

      // Jump
      if (this.isGrounded && this.moveState.jump) {
        this.velocity.y = this.jumpImpulse;
        this.isGrounded = false;
      }

      // Terminal velocity
      if (this.velocity.y < -50) {
        this.velocity.y = -50;
      }
    }

    // ---- Axis-separated collision detection & response ----
    this.isGrounded = false;

    // --- X axis ---
    const newX = this.position.x + this.velocity.x * dt;
    if (this._checkCollision(newX, this.position.y, this.position.z)) {
      // Horizontal collision — attempt step-up
      if (
        this._isOnGround() &&
        !this._checkCollision(newX, this.position.y + 1.01, this.position.z)
      ) {
        this.position.y += 1.01;
        this.position.x = newX;
      } else {
        this.velocity.x = 0;
      }
    } else {
      this.position.x = newX;
    }

    // --- Z axis ---
    const newZ = this.position.z + this.velocity.z * dt;
    if (this._checkCollision(this.position.x, this.position.y, newZ)) {
      // Horizontal collision — attempt step-up
      if (
        this._isOnGround() &&
        !this._checkCollision(this.position.x, this.position.y + 1.01, newZ)
      ) {
        this.position.y += 1.01;
        this.position.z = newZ;
      } else {
        this.velocity.z = 0;
      }
    } else {
      this.position.z = newZ;
    }

    // --- Y axis ---
    const newY = this.position.y + this.velocity.y * dt;
    if (this._checkCollision(this.position.x, newY, this.position.z)) {
      if (this.velocity.y < 0) {
        // Falling — landed on ground
        this.isGrounded = true;
      }
      this.velocity.y = 0;
    } else {
      this.position.y = newY;
    }

    // ---- Update camera ----
    const eyeHeight = this.position.y + this.playerHeight - 0.2;
    this.camera.position.set(this.position.x, eyeHeight, this.position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  // ---------------------------------------------------------------------------
  // Collision helpers
  // ---------------------------------------------------------------------------

  /**
   * Check whether an AABB placed at (x, y, z) overlaps any solid block.
   * The AABB spans:
   *   x - 0.3  to  x + 0.3
   *   y         to  y + playerHeight
   *   z - 0.3  to  z + 0.3
   *
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {boolean}
   */
  _checkCollision(x, y, z) {
    const halfW = this.playerWidth / 2; // 0.3

    const minX = Math.floor(x - halfW);
    const maxX = Math.floor(x + halfW);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + this.playerHeight);
    const minZ = Math.floor(z - halfW);
    const maxZ = Math.floor(z + halfW);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          // The block occupies [bx, bx+1) x [by, by+1) x [bz, bz+1)
          // The player AABB is [x-halfW, x+halfW) x [y, y+playerHeight) x [z-halfW, z+halfW)
          // Overlap check (axis-aligned):
          if (
            x + halfW > bx &&
            x - halfW < bx + 1 &&
            y + this.playerHeight > by &&
            y < by + 1 &&
            z + halfW > bz &&
            z - halfW < bz + 1
          ) {
            const blockId = this.chunkManager.getBlock(bx, by, bz);
            if (isSolid(blockId)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * Quick ground check — is there a solid block just below the player's feet?
   * Used to decide whether step-up is allowed.
   * @returns {boolean}
   */
  _isOnGround() {
    return this._checkCollision(
      this.position.x,
      this.position.y - 0.05,
      this.position.z,
    );
  }

  // ---------------------------------------------------------------------------
  // Public helpers
  // ---------------------------------------------------------------------------

  /**
   * Teleport the player to a specific position.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  setPosition(x, y, z) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
  }

  /**
   * Get the player's current foot position.
   * @returns {{ x: number, y: number, z: number }}
   */
  getPosition() {
    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
    };
  }
}
