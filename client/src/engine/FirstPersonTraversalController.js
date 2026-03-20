/**
 * FirstPersonTraversalController — configurable first-person traversal controller.
 *
 * Shared across colony surfaces today, and prepared for ship interiors and
 * derelict boarding scenes via traversal profiles.
 */

import * as THREE from 'three';
import { isSolid } from './BlockRegistry.js';
import { getTraversalProfile } from './traversalProfiles.js';

const PITCH_LIMIT = Math.PI / 2 - 0.017;

export class FirstPersonTraversalController {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {{ getBlock(wx: number, wy: number, wz: number): number }} chunkManager
   * @param {HTMLElement} domElement
   * @param {{ profileId?: string, overrides?: object }} options
   */
  constructor(camera, chunkManager, domElement, options = {}) {
    this.camera = camera;
    this.chunkManager = chunkManager;
    this.domElement = domElement;

    this.profile = getTraversalProfile(options.profileId);
    const controls = {
      ...this.profile.controls,
      ...(options.overrides || {}),
    };

    this.position = new THREE.Vector3(0, 60, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;

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
    this.keyboardMoveState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      flyUp: false,
      flyDown: false,
    };
    this.gamepadMoveState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      flyUp: false,
      flyDown: false,
    };

    this.isGrounded = false;
    this.flyMode = false;

    this.speed = controls.speed;
    this.sprintSpeed = controls.sprintSpeed;
    this.gravity = controls.gravity;
    this.jumpImpulse = controls.jumpImpulse;
    this.allowJump = controls.allowJump !== false;
    this.playerHeight = 1.7;
    this.playerWidth = 0.6;
    this.mouseSensitivity = controls.mouseSensitivity;
    this.gamepadLookSensitivity = controls.gamepadLookSensitivity;
    this.gamepadDeadzone = controls.gamepadDeadzone;
    this.allowFly = controls.allowFly;

    this.isLocked = false;
    this.gamepadActive = false;
    this.gamepadLookEnabled = false;
    this.gamepadTogglePressed = false;
    this.gamepadInteractPressed = false;
    this.gamepadButtons = {
      jump: false,
      sprint: false,
      flyUp: false,
      flyDown: false,
    };
    this.pendingInteraction = false;

    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
    this._onClick = this._handleClick.bind(this);
    this._onPointerLockChange = this._handlePointerLockChange.bind(this);
  }

  init() {
    this.domElement.addEventListener('click', this._onClick);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
  }

  dispose() {
    this.domElement.removeEventListener('click', this._onClick);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
  }

  _handleClick() {
    if (!this.isLocked) {
      this.domElement.requestPointerLock();
    }
  }

  _handlePointerLockChange() {
    this.isLocked = document.pointerLockElement === this.domElement;
    if (!this.isLocked && !this.gamepadLookEnabled) {
      this._resetMovementState();
    }
  }

  _handleMouseMove(e) {
    if (!this.isLocked) return;

    this.yaw -= e.movementX * this.mouseSensitivity;
    this.pitch -= e.movementY * this.mouseSensitivity;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
  }

  _handleKeyDown(e) {
    if (!this.hasControl()) return;
    // Stop propagation so global navigation shortcuts (on window) don't fire
    // while the player is in first-person control.
    e.stopPropagation();
    this._setKeyState(e.code, true);
  }

  _handleKeyUp(e) {
    if (!this.hasControl()) return;
    e.stopPropagation();
    this._setKeyState(e.code, false);
  }

  _resetMovementState() {
    const resetState = (state) => {
      state.forward = false;
      state.backward = false;
      state.left = false;
      state.right = false;
      state.jump = false;
      state.sprint = false;
      state.flyUp = false;
      state.flyDown = false;
    };

    resetState(this.moveState);
    resetState(this.keyboardMoveState);
    resetState(this.gamepadMoveState);
  }

  _toggleFlyMode() {
    if (!this.allowFly) {
      return;
    }

    this.flyMode = !this.flyMode;
    this.velocity.y = 0;
    if (!this.flyMode) {
      this.moveState.flyUp = false;
      this.moveState.flyDown = false;
    } else {
      this.moveState.jump = false;
    }
  }

  _setKeyState(code, pressed) {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keyboardMoveState.forward = pressed;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keyboardMoveState.backward = pressed;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keyboardMoveState.left = pressed;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keyboardMoveState.right = pressed;
        break;
      case 'Space':
        if (this.flyMode && this.allowFly) {
          this.keyboardMoveState.flyUp = pressed;
        } else if (!this.allowJump) {
          if (pressed) {
            this.pendingInteraction = true;
          }
        } else {
          this.keyboardMoveState.jump = pressed;
        }
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        if (this.flyMode && this.allowFly) {
          this.keyboardMoveState.flyDown = pressed;
        } else {
          this.keyboardMoveState.sprint = pressed;
        }
        break;
      case 'KeyF':
        if (pressed) {
          this._toggleFlyMode();
        }
        break;
      case 'KeyE':
        if (pressed) {
          this.pendingInteraction = true;
        }
        break;
      default:
        break;
    }
  }

  _syncMoveState() {
    this.moveState.forward = this.keyboardMoveState.forward || this.gamepadMoveState.forward;
    this.moveState.backward = this.keyboardMoveState.backward || this.gamepadMoveState.backward;
    this.moveState.left = this.keyboardMoveState.left || this.gamepadMoveState.left;
    this.moveState.right = this.keyboardMoveState.right || this.gamepadMoveState.right;
    this.moveState.jump = this.keyboardMoveState.jump || this.gamepadMoveState.jump;
    this.moveState.sprint = this.keyboardMoveState.sprint || this.gamepadMoveState.sprint;
    this.moveState.flyUp = this.keyboardMoveState.flyUp || this.gamepadMoveState.flyUp;
    this.moveState.flyDown = this.keyboardMoveState.flyDown || this.gamepadMoveState.flyDown;
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    this._updateGamepadState();
    this._syncMoveState();

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const direction = new THREE.Vector3(0, 0, 0);
    const moveX = (this.moveState.right ? 1 : 0) - (this.moveState.left ? 1 : 0);
    const moveZ = (this.moveState.forward ? 1 : 0) - (this.moveState.backward ? 1 : 0);
    if (moveZ > 0) direction.add(forward);
    if (moveZ < 0) direction.sub(forward);
    if (moveX < 0) direction.sub(right);
    if (moveX > 0) direction.add(right);

    if (direction.lengthSq() > 0) {
      direction.normalize();
    }

    const currentSpeed = this.moveState.sprint ? this.sprintSpeed : this.speed;

    if (this.flyMode && this.allowFly) {
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
      this.velocity.y += this.gravity * dt;

      if (this.isGrounded && this.moveState.jump) {
        this.velocity.y = this.jumpImpulse;
        this.isGrounded = false;
      }

      if (this.velocity.y < -50) {
        this.velocity.y = -50;
      }
    }

    this.isGrounded = false;

    const newX = this.position.x + this.velocity.x * dt;
    if (this._checkCollision(newX, this.position.y, this.position.z)) {
      if (this._isOnGround() && !this._checkCollision(newX, this.position.y + 1.01, this.position.z)) {
        this.position.y += 1.01;
        this.position.x = newX;
      } else {
        this.velocity.x = 0;
      }
    } else {
      this.position.x = newX;
    }

    const newZ = this.position.z + this.velocity.z * dt;
    if (this._checkCollision(this.position.x, this.position.y, newZ)) {
      if (this._isOnGround() && !this._checkCollision(this.position.x, this.position.y + 1.01, newZ)) {
        this.position.y += 1.01;
        this.position.z = newZ;
      } else {
        this.velocity.z = 0;
      }
    } else {
      this.position.z = newZ;
    }

    const newY = this.position.y + this.velocity.y * dt;
    if (this._checkCollision(this.position.x, newY, this.position.z)) {
      if (this.velocity.y < 0) {
        this.isGrounded = true;
      }
      this.velocity.y = 0;
    } else {
      this.position.y = newY;
    }

    const eyeHeight = this.position.y + this.playerHeight - 0.2;
    this.camera.position.set(this.position.x, eyeHeight, this.position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  _updateGamepadState() {
    const gamepad = navigator.getGamepads?.()[0];
    this.gamepadActive = Boolean(gamepad);

    if (!gamepad) {
      this.gamepadMoveState.forward = false;
      this.gamepadMoveState.backward = false;
      this.gamepadMoveState.left = false;
      this.gamepadMoveState.right = false;
      this.gamepadMoveState.jump = false;
      this.gamepadMoveState.sprint = false;
      this.gamepadMoveState.flyUp = false;
      this.gamepadMoveState.flyDown = false;
      this.gamepadTogglePressed = false;
      this.gamepadInteractPressed = false;
      return;
    }

    const readAxis = (index) => {
      const value = gamepad.axes[index] || 0;
      return Math.abs(value) >= this.gamepadDeadzone ? value : 0;
    };

    const leftX = readAxis(0);
    const leftY = readAxis(1);
    const rightX = readAxis(2);
    const rightY = readAxis(3);
    const interactPressed = Boolean(gamepad.buttons[0]?.pressed || gamepad.buttons[9]?.pressed);
    const toggleFlyPressed = Boolean(gamepad.buttons[3]?.pressed);
    const hadControl = this.hasControl();

    if (!hadControl && interactPressed && !this.gamepadInteractPressed) {
      this.gamepadLookEnabled = true;
    }
    const gainedControl = !hadControl && this.hasControl();

    if (
      this.hasControl() &&
      !gainedControl &&
      interactPressed &&
      !this.gamepadInteractPressed &&
      !this.allowJump
    ) {
      this.pendingInteraction = true;
    }
    this.gamepadInteractPressed = interactPressed;

    if (this.allowFly && toggleFlyPressed && !this.gamepadTogglePressed && this.hasControl()) {
      this._toggleFlyMode();
    }
    this.gamepadTogglePressed = toggleFlyPressed;

    this.gamepadMoveState.forward = leftY < -0.35;
    this.gamepadMoveState.backward = leftY > 0.35;
    this.gamepadMoveState.left = leftX < -0.35;
    this.gamepadMoveState.right = leftX > 0.35;
    this.gamepadMoveState.sprint = Boolean(gamepad.buttons[10]?.pressed || gamepad.buttons[4]?.pressed);

    if (this.flyMode && this.allowFly) {
      this.gamepadMoveState.flyUp = gainedControl ? false : Boolean(gamepad.buttons[0]?.pressed);
      this.gamepadMoveState.flyDown = Boolean(gamepad.buttons[1]?.pressed);
      this.gamepadMoveState.jump = false;
    } else {
      this.gamepadMoveState.jump =
        this.allowJump && !gainedControl ? Boolean(gamepad.buttons[0]?.pressed) : false;
      this.gamepadMoveState.flyUp = false;
      this.gamepadMoveState.flyDown = false;
    }

    if (this.hasControl()) {
      this.yaw -= rightX * this.gamepadLookSensitivity;
      this.pitch -= rightY * this.gamepadLookSensitivity * 0.8;
      this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
    }
  }

  _checkCollision(x, y, z) {
    const halfW = this.playerWidth / 2;
    const minX = Math.floor(x - halfW);
    const maxX = Math.floor(x + halfW);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + this.playerHeight);
    const minZ = Math.floor(z - halfW);
    const maxZ = Math.floor(z + halfW);

    for (let bx = minX; bx <= maxX; bx += 1) {
      for (let by = minY; by <= maxY; by += 1) {
        for (let bz = minZ; bz <= maxZ; bz += 1) {
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

  _isOnGround() {
    return this._checkCollision(this.position.x, this.position.y - 0.05, this.position.z);
  }

  setPosition(x, y, z) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
  }

  hasControl() {
    return this.isLocked || this.gamepadLookEnabled;
  }

  releaseControl() {
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
    this.gamepadLookEnabled = false;
    this._resetMovementState();
  }

  engageTraversalControl() {
    this.gamepadLookEnabled = true;
  }

  getInputState() {
    return {
      pointerLock: this.isLocked,
      gamepadActive: this.gamepadActive,
      gamepadLookEnabled: this.gamepadLookEnabled,
      flyMode: this.flyMode,
      allowFly: this.allowFly,
      allowJump: this.allowJump,
      profileId: this.profile.id,
      profileLabel: this.profile.label,
    };
  }

  getMovementState() {
    return {
      combined: { ...this.moveState },
      keyboard: { ...this.keyboardMoveState },
      gamepad: { ...this.gamepadMoveState },
    };
  }

  getProfile() {
    return this.profile;
  }

  consumeInteraction() {
    const triggered = this.pendingInteraction;
    this.pendingInteraction = false;
    return triggered;
  }

  getPosition() {
    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
    };
  }
}
