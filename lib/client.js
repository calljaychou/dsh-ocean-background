/**
 * dsh-ocean-background browser bundle.
 *
 * Adapted from stackedlol/ascii-sharks (MIT). The canvas lives behind the DSH
 * shell while a shell.overlay entry owns its lifecycle; a settings section
 * controls the scene without touching the host theme implementation.
 */
window.__ModuleLoader__.load({
  id: 'dsh-ocean-background',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useRef, useState } = React;

    const STYLE_ID = 'dsh-ocean-background-styles';
    const CONFIG_KEY = 'dsh-ocean-background:config:v1';
    const FRAME_ATTRIBUTE = 'data-dsh-ocean-frame';
    const ACTIVE_CLASS = 'dsh-ocean-active';
    const SHARK_NODES = 20;
    const TAU = Math.PI * 2;
    const clamp = (value, low, high) => (value < low ? low : value > high ? high : value);
    const rand = (low, high) => low + Math.random() * (high - low);
    const randInt = (low, high) => Math.floor(rand(low, high + 1));

    const SHARK_KINDS = {
      classic: { tint: [0.92, 0.97, 1.05], reach: 0.26 },
      hammerhead: { tint: [0.96, 0.98, 0.9], reach: 0.22 },
      zebra: { tint: [1.08, 0.97, 0.74], reach: 0.19 },
      tiger: { tint: [1.02, 0.95, 0.84], reach: 0.25 },
      greathammer: { tint: [0.86, 0.93, 1.02], reach: 0.24 },
      mako: { tint: [0.78, 0.9, 1.2], reach: 0.21 },
      thresher: { tint: [1, 0.9, 1.08], reach: 0.2 },
      nurse: { tint: [1.1, 0.96, 0.76], reach: 0.17 },
    };

    const OCEAN_PALETTES = {
      light: {
        background: '#f9fafb',
        grid: 'rgba(30, 52, 70, 0.05)',
        wake: [34, 142, 173],
        fish: [52, 72, 88],
        fishAlarm: [0, 124, 160],
        sharkBase: 238,
        sharkRange: 14,
        sharkDepthFloor: 0.94,
        sharkTintStrength: 0.24,
        sharkTextStrong: '#1c2a34',
        sharkTextSoft: '#3d4f5c',
        sharkEye: '#173746',
        sharkPattern: '#2d4351',
        sharkSpark: '#0b2a3b',
        accents: ['#bd5b0f', '#c52f28', '#8e2db8', '#087f86', '#338a3c', '#2945c6', '#9a7b0b'],
        heatHot: [237, 105, 54],
        heatCool: [194, 64, 54],
      },
      dark: {
        background: '#020408',
        grid: 'rgba(255, 255, 255, 0.045)',
        wake: [110, 230, 255],
        fish: [230, 238, 255],
        fishAlarm: [150, 232, 255],
        sharkBase: 42,
        sharkRange: 165,
        sharkDepthFloor: 0.72,
        sharkTintStrength: 1,
        sharkTextStrong: '#0c1016',
        sharkTextSoft: '#161c25',
        sharkEye: '#aeb7c7',
        sharkPattern: '#202936',
        sharkSpark: '#ffffff',
        accents: ['#e0892c', '#e03a32', '#b44ae0', '#33c8cc', '#3cb54a', '#3150e8', '#d9c14a'],
        heatHot: [255, 120, 60],
        heatCool: [220, 40, 40],
      },
    };

    function normalizeColorScheme(value) {
      return value === 'dark' ? 'dark' : 'light';
    }

    function detectColorScheme() {
      if (typeof document === 'undefined' || document.body === undefined) return 'light';
      return document.body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light';
    }

    function rgba(rgb, alpha) {
      return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
    }

    function parseHexColor(value) {
      if (typeof value !== 'string') return null;
      const match = /^#([0-9a-f]{6})$/i.exec(value.trim());
      if (match === null) return null;
      const hex = match[1];
      return [
        Number.parseInt(hex.slice(0, 2), 16),
        Number.parseInt(hex.slice(2, 4), 16),
        Number.parseInt(hex.slice(4, 6), 16),
      ];
    }

    function colorLuminance(rgb) {
      return (rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722) / 255;
    }

    function createSharkInk(rgb) {
      if (colorLuminance(rgb) > 0.52) {
        return {
          sharkTextStrong: '#18262f',
          sharkTextSoft: '#40525f',
          sharkEye: '#103443',
          sharkPattern: '#2e4351',
          sharkSpark: '#0a2938',
        };
      }
      return {
        sharkTextStrong: '#eef5fa',
        sharkTextSoft: '#cbd8e2',
        sharkEye: '#f5fbff',
        sharkPattern: '#b9cbd8',
        sharkSpark: '#ffffff',
      };
    }

    let currentColorScheme = detectColorScheme();
    const colorSchemeListeners = new Set();

    function updateColorScheme(value) {
      const next = normalizeColorScheme(value);
      if (next === currentColorScheme) return;
      currentColorScheme = next;
      for (const listener of colorSchemeListeners) listener(next);
    }

    function subscribeColorScheme(listener) {
      colorSchemeListeners.add(listener);
      return () => colorSchemeListeners.delete(listener);
    }

    const SHARK_PRESETS = {
      classics: {
        label: '经典鲨群',
        sharks: [
          { kind: 'classic', size: 1 },
          { kind: 'classic', size: 0.7 },
          { kind: 'classic', size: 0.84 },
          { kind: 'classic', size: 0.77 },
        ],
      },
      reef: {
        label: '珊瑚礁',
        sharks: [
          { kind: 'nurse', size: 1 },
          { kind: 'zebra', size: 0.76 },
          { kind: 'tiger', size: 0.88 },
        ],
      },
      pelagic: {
        label: '远洋猎手',
        sharks: [
          { kind: 'mako', size: 1 },
          { kind: 'hammerhead', size: 0.92 },
          { kind: 'thresher', size: 0.86 },
          { kind: 'classic', size: 0.72 },
        ],
      },
      solo: {
        label: '孤独巡游',
        sharks: [{ kind: 'greathammer', size: 1 }],
      },
    };

    const DEFAULT_CONFIG = {
      enabled: true,
      preset: 'classics',
      canvasOpacity: 0.88,
      panelOpacity: 0.78,
      sharkColor: null,
      generation: 0,
    };

    function numeric(value, fallback) {
      return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    }

    function normalizeConfig(value) {
      const source = value !== null && typeof value === 'object' ? value : {};
      const preset = Object.hasOwn(SHARK_PRESETS, source.preset) ? source.preset : DEFAULT_CONFIG.preset;
      const sharkColor =
        parseHexColor(source.sharkColor) === null ? null : source.sharkColor.toLowerCase();
      return {
        enabled: source.enabled !== false,
        preset,
        canvasOpacity: clamp(numeric(source.canvasOpacity, DEFAULT_CONFIG.canvasOpacity), 0.35, 1),
        panelOpacity: clamp(numeric(source.panelOpacity, DEFAULT_CONFIG.panelOpacity), 0.5, 0.96),
        sharkColor,
        generation: Math.max(0, Math.trunc(numeric(source.generation, 0))),
      };
    }

    function readConfig() {
      try {
        const raw = window.localStorage.getItem(CONFIG_KEY);
        return normalizeConfig(raw === null ? DEFAULT_CONFIG : JSON.parse(raw));
      } catch {
        return { ...DEFAULT_CONFIG };
      }
    }

    let currentConfig = readConfig();
    const configListeners = new Set();

    function updateConfig(patch) {
      currentConfig = normalizeConfig({ ...currentConfig, ...patch });
      try {
        window.localStorage.setItem(CONFIG_KEY, JSON.stringify(currentConfig));
      } catch {
        // A blocked storage area must not break the background.
      }
      for (const listener of configListeners) listener(currentConfig);
    }

    function subscribeConfig(listener) {
      configListeners.add(listener);
      return () => configListeners.delete(listener);
    }

    function angleDiff(from, to) {
      let value = (to - from) % TAU;
      if (value > Math.PI) value -= TAU;
      if (value < -Math.PI) value += TAU;
      return value;
    }

    function hash3(x, y, z) {
      let value =
        Math.imul(x | 0, 374761393) ^
        Math.imul(y | 0, 668265263) ^
        Math.imul(z | 0, 1442695041);
      value = Math.imul(value ^ (value >>> 13), 1274126177);
      value ^= value >>> 16;
      return (value >>> 0) / 4294967296;
    }

    const CURRENT_K1 = 1 / 260;
    const CURRENT_K2 = 1 / 310;
    const CURRENT_K3 = 1 / 190;

    function oceanCurrent(x, y, time, output) {
      const a = x * CURRENT_K1 + time * 0.07;
      const b = y * CURRENT_K2 - time * 0.05;
      const c = (x + y) * CURRENT_K3 + time * 0.11;
      output.x = (-CURRENT_K2 * Math.sin(a) * Math.sin(b) + 0.5 * CURRENT_K3 * Math.cos(c)) * 3400;
      output.y = (-CURRENT_K1 * Math.cos(a) * Math.cos(b) - 0.5 * CURRENT_K3 * Math.cos(c)) * 3400;
      return output;
    }

    const SPECIES = [
      {
        name: 'sardine',
        cruise: 36,
        maxSpeed: 64,
        minSpeed: 18,
        weight: 3,
        schoolSize: [18, 28],
        spacing: [1.8, 1.1],
        align: 1.6,
        cohesion: 1.6,
        jitter: 40,
        mill: 70,
        verticalDrag: 0.5,
      },
      {
        name: 'anchovy',
        cruise: 46,
        maxSpeed: 78,
        minSpeed: 22,
        weight: 3,
        schoolSize: [20, 32],
        spacing: [1.5, 1],
        align: 3.2,
        cohesion: 0.45,
        jitter: 30,
        mill: 0,
        verticalDrag: 1.4,
      },
      {
        name: 'silverside',
        cruise: 40,
        maxSpeed: 70,
        minSpeed: 20,
        weight: 3,
        schoolSize: [12, 20],
        spacing: [2, 1.1],
        align: 2.4,
        cohesion: 1.1,
        jitter: 35,
        mill: 0,
        verticalDrag: 1.6,
      },
      {
        name: 'mackerel',
        cruise: 32,
        maxSpeed: 60,
        minSpeed: 16,
        weight: 2,
        schoolSize: [5, 9],
        spacing: [2.6, 1.3],
        align: 2,
        cohesion: 0.9,
        jitter: 25,
        mill: 0,
        verticalDrag: 2,
      },
    ];

    const TOTAL_WEIGHT = SPECIES.reduce((sum, species) => sum + species.weight, 0);

    function pickSpecies() {
      let value = Math.random() * TOTAL_WEIGHT;
      for (let index = 0; index < SPECIES.length; index++) {
        value -= SPECIES[index].weight;
        if (value <= 0) return index;
      }
      return 0;
    }

    const FISH_SEPARATION_K = 420;
    const FISH_ALIGN_K = 1.4;
    const FISH_COHESION_K = 1;
    const FISH_FLEE_K = 1100;
    const BLIND_COS = -0.6;

    class OceanWorld {
      constructor(sharkSpecs, fishCount) {
        this.sharkSpecs = sharkSpecs;
        this.fishCount = fishCount;
        this.width = 0;
        this.height = 0;
        this.time = 0;
        this.fish = [];
        this.sharks = [];
        this.events = [];
        this.pointer = { x: 0, y: 0, active: false };
        this.perception = 70;
        this.sepX = [];
        this.sepY = [];
        this.foreignSep = 40;
        this.lastSpawn = 0;
        this.current = { x: 0, y: 0 };
      }

      resize(width, height, cellWidth, cellHeight) {
        const first = this.width === 0;
        this.width = width;
        this.height = height;
        this.sepX = SPECIES.map((species) => species.spacing[0] * cellWidth);
        this.sepY = SPECIES.map((species) => species.spacing[1] * cellHeight);
        this.perception = Math.max(cellHeight * 3, cellWidth * 5.5);
        this.foreignSep = cellWidth * 3;
        if (first || this.fish.length === 0) {
          this.seed();
          return;
        }
        for (const fish of this.fish) {
          fish.x = clamp(fish.x, 0, width);
          fish.y = clamp(fish.y, 0, height);
        }
      }

      seed() {
        const width = this.width;
        const height = this.height;
        const minSide = Math.min(width, height);
        const baseLength = clamp(minSide * 0.44, 170, 430);
        const sharkCount = this.sharkSpecs.length;
        this.sharks = [];

        for (let index = 0; index < sharkCount; index++) {
          const spec = this.sharkSpecs[index];
          const kind = SHARK_KINDS[spec.kind] === undefined ? 'classic' : spec.kind;
          const length = baseLength * clamp(spec.size, 0.45, 1.2);
          const orbitRadius = minSide * rand(0.28, 0.4);
          const angle = (index / Math.max(1, sharkCount)) * TAU + rand(-0.4, 0.4);
          const orbitDir = index % 2 === 0 ? 1 : -1;
          const x = width / 2 + Math.cos(angle) * orbitRadius * (width / minSide) * 0.9;
          const y = height / 2 + Math.sin(angle) * orbitRadius;
          const heading = angle + (orbitDir * Math.PI) / 2;
          const nodes = new Float32Array(SHARK_NODES * 2);
          const segment = length / (SHARK_NODES - 1);
          for (let node = 0; node < SHARK_NODES; node++) {
            nodes[node * 2] = x - Math.cos(heading) * segment * node;
            nodes[node * 2 + 1] = y - Math.sin(heading) * segment * node;
          }
          this.sharks.push({
            id: index + 1,
            kind,
            length,
            nodes,
            heading,
            speed: 30,
            phase: rand(0, TAU),
            turn: 0,
            hunger: rand(0.25, 0.75),
            wander: 0,
            orbitDir,
            orbitRadius,
            target: null,
            retargetAt: 0,
            depth: clamp(spec.size, 0.45, 1.2),
          });
        }
        this.sharks.sort((left, right) => left.length - right.length);

        const total = this.fishCount ?? clamp(Math.round((width * height) / 6800), 55, 170);
        this.fish = [];
        while (this.fish.length < total) {
          const speciesIndex = pickSpecies();
          const species = SPECIES[speciesIndex];
          const schoolSize = Math.min(
            randInt(species.schoolSize[0], species.schoolSize[1]),
            total - this.fish.length,
          );
          const millDir = Math.random() < 0.5 ? 1 : -1;
          const centerX = rand(width * 0.06, width * 0.94);
          const centerY = rand(height * 0.08, height * 0.92);
          const direction = (Math.random() < 0.5 ? 0 : Math.PI) + rand(-0.5, 0.5);
          for (let index = 0; index < schoolSize; index++) {
            this.fish.push({
              x: centerX + rand(-1, 1) * this.sepX[speciesIndex] * Math.sqrt(schoolSize),
              y:
                centerY +
                rand(-1, 1) *
                  this.sepY[speciesIndex] *
                  Math.sqrt(schoolSize) *
                  0.6,
              vx: Math.cos(direction) * species.cruise,
              vy: Math.sin(direction) * species.cruise,
              species: speciesIndex,
              alarm: 0,
              alive: true,
              respawnAt: 0,
              phase: rand(0, TAU),
              turn: 0,
              depth: rand(0.55, 1),
              millDir,
            });
          }
        }
      }

      splash(x, y) {
        this.events.push({ kind: 'splash', x, y });
        const radius = 240;
        for (const fish of this.fish) {
          if (!fish.alive) continue;
          const dx = fish.x - x;
          const dy = fish.y - y;
          const distance = Math.hypot(dx, dy);
          if (distance > radius || distance < 1e-3) continue;
          const force = (1 - distance / radius) * 260;
          fish.vx += (dx / distance) * force;
          fish.vy += (dy / distance) * force;
          fish.alarm = 1;
        }
      }

      step(dt) {
        this.time += dt;
        this.buildNeighborHash();
        this.stepFish(dt);
        this.stepSharks(dt);
        this.respawn();
      }

      buildNeighborHash() {
        this.hash = new Map();
        const size = this.perception;
        for (let index = 0; index < this.fish.length; index++) {
          const fish = this.fish[index];
          if (!fish.alive) continue;
          const column = Math.floor(fish.x / size);
          const row = Math.floor(fish.y / size);
          const key = row * 10000 + column;
          let bucket = this.hash.get(key);
          if (bucket === undefined) {
            bucket = [];
            this.hash.set(key, bucket);
          }
          bucket.push(index);
        }
      }

      stepFish(dt) {
        const width = this.width;
        const height = this.height;
        const size = this.perception;
        const radiusSquared = size * size;
        const calmDecay = Math.exp(-dt * 0.7);
        const contagion = Math.min(1, dt * 6);

        for (let index = 0; index < this.fish.length; index++) {
          const fish = this.fish[index];
          if (!fish.alive) continue;
          const species = SPECIES[fish.species];
          const spread = 1 + 1.8 * fish.alarm;
          const separationX = this.sepX[fish.species] * spread;
          const separationY = this.sepY[fish.species] * spread;
          const speed = Math.hypot(fish.vx, fish.vy) || 1;
          const headingX = fish.vx / speed;
          const headingY = fish.vy / speed;
          let accelerationX = 0;
          let accelerationY = 0;
          let separationForceX = 0;
          let separationForceY = 0;
          let averageVelocityX = 0;
          let averageVelocityY = 0;
          let cohesionX = 0;
          let cohesionY = 0;
          let neighborCount = 0;
          let neighborAlarm = 0;

          const column = Math.floor(fish.x / size);
          const row = Math.floor(fish.y / size);
          for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
            for (let columnOffset = -1; columnOffset <= 1; columnOffset++) {
              const bucket = this.hash.get((row + rowOffset) * 10000 + column + columnOffset);
              if (bucket === undefined) continue;
              for (const neighborIndex of bucket) {
                if (neighborIndex === index) continue;
                const neighbor = this.fish[neighborIndex];
                const dx = neighbor.x - fish.x;
                const dy = neighbor.y - fish.y;
                const distanceSquared = dx * dx + dy * dy;
                if (distanceSquared >= radiusSquared || distanceSquared <= 1e-6) continue;
                const distance = Math.sqrt(distanceSquared);
                if ((dx * headingX + dy * headingY) / distance <= BLIND_COS) continue;

                const ellipseX = dx / separationX;
                const ellipseY = dy / separationY;
                const ellipseSquared = ellipseX * ellipseX + ellipseY * ellipseY;
                if (ellipseSquared < 1) {
                  const ellipse = Math.sqrt(ellipseSquared) || 1e-3;
                  const force = (1 - ellipse) / ellipse;
                  separationForceX -= ellipseX * force;
                  separationForceY -= ellipseY * force;
                }

                if (neighbor.species === fish.species) {
                  averageVelocityX += neighbor.vx;
                  averageVelocityY += neighbor.vy;
                  cohesionX += dx;
                  cohesionY += dy;
                  neighborCount++;
                } else if (distance < this.foreignSep) {
                  const force = ((1 - distance / this.foreignSep) / distance) * 0.6;
                  separationForceX -= dx * force;
                  separationForceY -= dy * force;
                }
                neighborAlarm = Math.max(neighborAlarm, neighbor.alarm);
              }
            }
          }

          accelerationX += separationForceX * FISH_SEPARATION_K;
          accelerationY += separationForceY * FISH_SEPARATION_K;
          if (neighborCount > 0) {
            const align = FISH_ALIGN_K * species.align;
            const cohesion = FISH_COHESION_K * species.cohesion * (1 - 0.8 * fish.alarm);
            accelerationX +=
              (averageVelocityX / neighborCount - fish.vx) * align +
              (cohesionX / neighborCount) * cohesion;
            accelerationY +=
              (averageVelocityY / neighborCount - fish.vy) * align +
              (cohesionY / neighborCount) * cohesion;
            if (species.mill > 0) {
              const length = Math.hypot(cohesionX, cohesionY) || 1;
              accelerationX +=
                (-cohesionY / length) * fish.millDir * species.mill * (1 - fish.alarm);
              accelerationY +=
                (cohesionX / length) * fish.millDir * species.mill * (1 - fish.alarm);
            }
          }

          let fear = 0;
          for (const shark of this.sharks) {
            const fearRadius = shark.length * 0.6 + 60;
            let nearestDistanceSquared = Infinity;
            let nearestX = 0;
            let nearestY = 0;
            for (let node = 0; node <= 12; node += 3) {
              const nodeX = shark.nodes[node * 2];
              const nodeY = shark.nodes[node * 2 + 1];
              const distanceSquared = (fish.x - nodeX) ** 2 + (fish.y - nodeY) ** 2;
              if (distanceSquared < nearestDistanceSquared) {
                nearestDistanceSquared = distanceSquared;
                nearestX = nodeX;
                nearestY = nodeY;
              }
            }
            const distance = Math.sqrt(nearestDistanceSquared);
            if (distance >= fearRadius || distance < 1e-3) continue;
            let weight = 1 - distance / fearRadius;
            weight *= weight;
            const awayX = (fish.x - nearestX) / distance;
            const awayY = (fish.y - nearestY) / distance;
            const sharkHeadingX = Math.cos(shark.heading);
            const sharkHeadingY = Math.sin(shark.heading);
            const side =
              sharkHeadingX * (fish.y - shark.nodes[1]) -
                sharkHeadingY * (fish.x - shark.nodes[0]) >=
              0
                ? 1
                : -1;
            accelerationX +=
              (awayX * 0.7 - sharkHeadingY * side * 0.9) * FISH_FLEE_K * weight;
            accelerationY +=
              (awayY * 0.7 + sharkHeadingX * side * 0.9) * FISH_FLEE_K * weight;
            fear = Math.max(fear, Math.sqrt(weight));
          }

          if (this.pointer.active) {
            const dangerRadius = 130;
            const dx = fish.x - this.pointer.x;
            const dy = fish.y - this.pointer.y;
            const distance = Math.hypot(dx, dy);
            if (distance < dangerRadius && distance > 1e-3) {
              const weight = (1 - distance / dangerRadius) ** 2;
              accelerationX += (dx / distance) * FISH_FLEE_K * weight;
              accelerationY += (dy / distance) * FISH_FLEE_K * weight;
              fear = Math.max(fear, Math.sqrt(weight) * 0.8);
            }
          }

          let alarm = Math.max(fish.alarm * calmDecay, fear);
          const relayed = neighborAlarm * 0.86;
          if (relayed > alarm) alarm += (relayed - alarm) * contagion;
          fish.alarm = alarm;

          const margin = 36;
          if (fish.x < margin) accelerationX += (margin - fish.x) * 7;
          else if (fish.x > width - margin) accelerationX -= (fish.x - (width - margin)) * 7;
          if (fish.y < margin) accelerationY += (margin - fish.y) * 7;
          else if (fish.y > height - margin) accelerationY -= (fish.y - (height - margin)) * 7;

          oceanCurrent(fish.x, fish.y, this.time, this.current);
          accelerationX += this.current.x * 0.5 + (Math.random() - 0.5) * species.jitter;
          accelerationY += this.current.y * 0.5 + (Math.random() - 0.5) * species.jitter;
          accelerationY -= fish.vy * species.verticalDrag * (1 - 0.7 * fish.alarm);

          const preferredSpeed = species.cruise * (1 + 1.3 * fish.alarm);
          accelerationX += (preferredSpeed - speed) * headingX * 1.6;
          accelerationY += (preferredSpeed - speed) * headingY * 1.6;

          const previousHeading = Math.atan2(fish.vy, fish.vx);
          fish.vx += accelerationX * dt;
          fish.vy += accelerationY * dt;
          const maximumSpeed = species.maxSpeed * (1 + 1.8 * fish.alarm);
          const currentSpeed = Math.hypot(fish.vx, fish.vy);
          if (currentSpeed > maximumSpeed) {
            fish.vx *= maximumSpeed / currentSpeed;
            fish.vy *= maximumSpeed / currentSpeed;
          } else if (currentSpeed < species.minSpeed && currentSpeed > 1e-3) {
            fish.vx *= species.minSpeed / currentSpeed;
            fish.vy *= species.minSpeed / currentSpeed;
          }
          fish.turn +=
            (angleDiff(previousHeading, Math.atan2(fish.vy, fish.vx)) / dt - fish.turn) *
            Math.min(1, dt * 8);
          fish.phase += dt * (7 + Math.hypot(fish.vx, fish.vy) * 0.12);
          fish.x = clamp(fish.x + fish.vx * dt, -60, width + 60);
          fish.y = clamp(fish.y + fish.vy * dt, -60, height + 60);
        }
      }

      stepSharks(dt) {
        const width = this.width;
        const height = this.height;
        const minSide = Math.min(width, height);
        const centerX = width / 2;
        const centerY = height / 2;

        for (const shark of this.sharks) {
          const length = shark.length;
          const nodes = shark.nodes;
          const headX = nodes[0];
          const headY = nodes[1];
          shark.hunger = Math.min(1, shark.hunger + dt * 0.03);

          let desiredX = Math.cos(shark.heading);
          let desiredY = Math.sin(shark.heading);
          shark.wander = clamp(
            shark.wander + (Math.random() - 0.5) * dt * 3.2,
            -1.1,
            1.1,
          );
          desiredX += Math.cos(shark.heading + shark.wander) * 0.45;
          desiredY += Math.sin(shark.heading + shark.wander) * 0.45;

          if (this.time >= shark.retargetAt) {
            shark.target = this.findPrey(shark);
            shark.retargetAt = this.time + 0.45;
          }
          const target = shark.target;
          let hunting = false;
          let closing = 0;
          if (target !== null && target.alive && shark.hunger > 0.3) {
            const targetX = target.x + target.vx * 0.35 - headX;
            const targetY = target.y + target.vy * 0.35 - headY;
            const distance = Math.hypot(targetX, targetY) || 1;
            const weight = 1.4 + 2.6 * shark.hunger;
            desiredX += (targetX / distance) * weight;
            desiredY += (targetY / distance) * weight;
            hunting = true;
            closing = clamp(1 - distance / (length * 0.9), 0, 1);
          } else {
            const orbitX = (headX - centerX) / (width / minSide);
            const orbitY = headY - centerY;
            const distance = Math.hypot(orbitX, orbitY) || 1;
            const radius =
              shark.orbitRadius * (1 + 0.15 * Math.sin(this.time * 0.05 + shark.id));
            const radial = clamp((radius - distance) / radius, -1, 1);
            desiredX +=
              ((-orbitY / distance) * shark.orbitDir + (orbitX / distance) * radial * 0.9) *
              0.55;
            desiredY +=
              ((orbitX / distance) * shark.orbitDir + (orbitY / distance) * radial * 0.9) *
              0.55;
          }

          for (const other of this.sharks) {
            if (other === shark) continue;
            for (let node = 0; node < SHARK_NODES; node += 4) {
              const offsetX = headX - other.nodes[node * 2];
              const offsetY = headY - other.nodes[node * 2 + 1];
              const distance = Math.hypot(offsetX, offsetY);
              const range = (length + other.length) * 0.45;
              if (distance < range && distance > 1e-3) {
                const weight = (1 - distance / range) * 3;
                desiredX += (offsetX / distance) * weight;
                desiredY += (offsetY / distance) * weight;
              }
            }
          }

          const ellipseX = (headX - centerX) / (width * 0.3);
          const ellipseY = (headY - centerY) / (height * 0.16);
          const ellipseSquared = ellipseX * ellipseX + ellipseY * ellipseY;
          if (ellipseSquared < 1) {
            const ellipse = Math.sqrt(ellipseSquared) || 1e-3;
            const weight = (1 - ellipse) * (hunting ? 1 : 2.5);
            desiredX += (ellipseX / ellipse) * weight;
            desiredY += (ellipseY / ellipse) * weight;
          }

          const overshoot = Math.max(-headX, headX - width, -headY, headY - height);
          if (overshoot > -length * 0.05) {
            const weight =
              clamp((overshoot + length * 0.05) / (length * 0.35), 0, 1) * 3.5;
            const towardX = centerX - headX;
            const towardY = centerY - headY;
            const distance = Math.hypot(towardX, towardY) || 1;
            desiredX += (towardX / distance) * weight;
            desiredY += (towardY / distance) * weight;
          }

          const desiredHeading = Math.atan2(desiredY, desiredX);
          const agility = Math.min(
            hunting ? 1.7 + closing : 0.8,
            shark.speed / (length * 0.22),
          );
          const maxTurn = agility * dt;
          const turned = clamp(angleDiff(shark.heading, desiredHeading), -maxTurn, maxTurn);
          shark.heading += turned;
          shark.turn += (turned / dt - shark.turn) * Math.min(1, dt * 3);

          const cruise = 30 + length * 0.04;
          const targetSpeed = hunting ? cruise * (1.45 + closing * 1.5) : cruise;
          shark.speed += (targetSpeed - shark.speed) * Math.min(1, dt * 1.1);
          shark.phase += dt * (2 + shark.speed / 24);

          nodes[0] += Math.cos(shark.heading) * shark.speed * dt;
          nodes[1] += Math.sin(shark.heading) * shark.speed * dt;

          const segment = length / (SHARK_NODES - 1);
          const maxBend = 0.16;
          let previousAngle = shark.heading + Math.PI;
          for (let node = 1; node < SHARK_NODES; node++) {
            const previousX = nodes[(node - 1) * 2];
            const previousY = nodes[(node - 1) * 2 + 1];
            let angle = Math.atan2(
              nodes[node * 2 + 1] - previousY,
              nodes[node * 2] - previousX,
            );
            angle =
              previousAngle +
              clamp(angleDiff(previousAngle, angle), -maxBend, maxBend);
            nodes[node * 2] = previousX + Math.cos(angle) * segment;
            nodes[node * 2 + 1] = previousY + Math.sin(angle) * segment;
            previousAngle = angle;
          }

          if (shark.hunger > 0.15) {
            const mouthRadius = length * 0.05 + 8;
            const mouthX = nodes[0];
            const mouthY = nodes[1];
            for (const fish of this.fish) {
              if (!fish.alive) continue;
              if ((fish.x - mouthX) ** 2 + (fish.y - mouthY) ** 2 < mouthRadius ** 2) {
                fish.alive = false;
                fish.respawnAt = this.time + rand(3, 8);
                shark.hunger = Math.max(0, shark.hunger - 0.16);
                this.events.push({ kind: 'eat', x: fish.x, y: fish.y });
              }
            }
          }
        }
      }

      findPrey(shark) {
        const range = shark.length * 0.9 + 160;
        const headX = shark.nodes[0];
        const headY = shark.nodes[1];
        const forwardX = Math.cos(shark.heading);
        const forwardY = Math.sin(shark.heading);
        let best = null;
        let bestScore = Infinity;
        let currentScore = Infinity;

        for (const fish of this.fish) {
          if (!fish.alive) continue;
          const dx = fish.x - headX;
          const dy = fish.y - headY;
          const distance = Math.hypot(dx, dy);
          if (distance > range || distance < 1e-3) continue;
          const cosine = (dx * forwardX + dy * forwardY) / distance;
          if (cosine < 0.2) continue;
          const score = distance * (1 + (1 - cosine) * 0.8);
          if (score < bestScore) {
            bestScore = score;
            best = fish;
          }
          if (fish === shark.target) currentScore = score;
        }
        if (shark.target !== null && currentScore < bestScore * 1.3) return shark.target;
        return best;
      }

      respawn() {
        const due = [];
        for (const fish of this.fish) {
          if (!fish.alive && fish.respawnAt <= this.time) due.push(fish);
        }
        if (due.length === 0) return;
        if (due.length < 6 && this.time - this.lastSpawn < 9) return;
        this.lastSpawn = this.time;

        const side = randInt(0, 3);
        const along = rand(0.15, 0.85);
        const x =
          side === 0 ? -20 : side === 1 ? this.width + 20 : along * this.width;
        const y =
          side === 2 ? -20 : side === 3 ? this.height + 20 : along * this.height;
        const inward =
          Math.atan2(this.height / 2 - y, this.width / 2 - x) + rand(-0.5, 0.5);
        const speciesIndex = pickSpecies();
        const species = SPECIES[speciesIndex];
        const millDir = Math.random() < 0.5 ? 1 : -1;
        const count = Math.min(due.length, species.schoolSize[1]);
        for (let index = 0; index < count; index++) {
          const fish = due[index];
          fish.alive = true;
          fish.species = speciesIndex;
          fish.alarm = 0;
          fish.turn = 0;
          fish.millDir = millDir;
          fish.x = x + rand(-1, 1) * this.perception;
          fish.y = y + rand(-1, 1) * this.perception;
          fish.vx = Math.cos(inward) * species.cruise * 1.4;
          fish.vy = Math.sin(inward) * species.cruise * 1.4;
        }
      }
    }

    const SKIN_RAMP = ':;t%SX8#@';

    function sharkHalfWidth(kind, progress) {
      if (kind === 'hammerhead' || kind === 'greathammer') {
        if (progress < 0.06) return 0.045;
        if (progress < 0.3) return 0.045 + 0.061 * ((progress - 0.06) / 0.24);
        return (0.019 + 0.087 * Math.pow(1 - (progress - 0.3) / 0.54, 1.25)) * 0.92;
      }
      if (kind === 'zebra') {
        if (progress < 0.1) return 0.075 * Math.sin(((progress / 0.1) * Math.PI) / 2);
        if (progress < 0.28) return 0.075 + 0.025 * ((progress - 0.1) / 0.18);
        if (progress < 0.55) return 0.022 + 0.078 * (1 - (progress - 0.28) / 0.27);
        const tail = (progress - 0.55) / 0.45;
        return 0.022 * (1 - tail * tail) + 0.012 * Math.sin(tail * Math.PI);
      }
      if (kind === 'mako') {
        if (progress < 0.17) return 0.088 * Math.pow(Math.sin(((progress / 0.17) * Math.PI) / 2), 1.5);
        if (progress < 0.32) return 0.088 + 0.012 * ((progress - 0.17) / 0.15);
        return 0.014 + 0.086 * Math.pow(1 - (progress - 0.32) / 0.54, 1.45);
      }
      if (kind === 'thresher') {
        if (progress < 0.08) return 0.07 * Math.sin(((progress / 0.08) * Math.PI) / 2);
        if (progress < 0.2) return 0.07 + 0.02 * ((progress - 0.08) / 0.12);
        if (progress < 0.48) return 0.012 + 0.078 * (1 - (progress - 0.2) / 0.28);
        const tail = (progress - 0.48) / 0.52;
        return 0.012 * (1 - tail) + 0.006 * Math.sin(tail * Math.PI * 0.9) + 0.002;
      }
      if (kind === 'nurse') {
        if (progress < 0.08) return 0.085 * Math.sin(((progress / 0.08) * Math.PI) / 2);
        if (progress < 0.3) return 0.085 + 0.02 * ((progress - 0.08) / 0.22);
        if (progress < 0.72) return 0.022 + 0.083 * (1 - (progress - 0.3) / 0.42);
        const tail = (progress - 0.72) / 0.28;
        return 0.022 * (1 - tail * tail) + 0.014 * Math.sin(tail * Math.PI);
      }
      if (kind === 'tiger') {
        if (progress < 0.13) return 0.1 * Math.pow(Math.sin(((progress / 0.13) * Math.PI) / 2), 0.45);
        if (progress < 0.3) return 0.1 + 0.014 * ((progress - 0.13) / 0.17);
        return 0.019 + 0.095 * Math.pow(1 - (progress - 0.3) / 0.54, 1.2);
      }
      if (progress < 0.13) return 0.09 * Math.pow(Math.sin(((progress / 0.13) * Math.PI) / 2), 0.95);
      if (progress < 0.3) return 0.09 + 0.016 * ((progress - 0.13) / 0.17);
      return 0.019 + 0.087 * Math.pow(1 - (progress - 0.3) / 0.54, 1.25);
    }

    class AsciiRenderer {
      constructor(canvas, colorScheme = detectColorScheme(), sharkColor = null) {
        const context = canvas.getContext('2d', { alpha: false });
        if (context === null) throw new Error('2D canvas unavailable');
        this.canvas = canvas;
        this.context = context;
        this.colorScheme = normalizeColorScheme(colorScheme);
        this.palette = OCEAN_PALETTES[this.colorScheme];
        this.sharkColor = parseHexColor(sharkColor);
        this.sharkInk = this.sharkColor === null
          ? this.palette
          : createSharkInk(this.sharkColor);
        this.width = 0;
        this.height = 0;
        this.dpr = 1;
        this.cellWidth = 12;
        this.cellHeight = 18;
        this.columns = 0;
        this.rows = 0;
        this.energy = new Float32Array(0);
        this.energyNext = new Float32Array(0);
        this.heat = new Float32Array(0);
        this.spine = new Float32Array(SHARK_NODES * 2);
        this.arc = new Float32Array(SHARK_NODES);
        this.arcTotal = 1;
        this.canvas.dataset.dshOceanTheme = this.colorScheme;
      }

      setColorScheme(colorScheme) {
        const next = normalizeColorScheme(colorScheme);
        if (next === this.colorScheme) return;
        this.colorScheme = next;
        this.palette = OCEAN_PALETTES[next];
        this.sharkInk = this.sharkColor === null
          ? this.palette
          : createSharkInk(this.sharkColor);
        this.canvas.dataset.dshOceanTheme = next;
      }

      setSharkColor(sharkColor) {
        this.sharkColor = parseHexColor(sharkColor);
        this.sharkInk = this.sharkColor === null
          ? this.palette
          : createSharkInk(this.sharkColor);
      }

      resize(width, height, dpr) {
        this.width = width;
        this.height = height;
        this.dpr = dpr;
        this.cellWidth = clamp(Math.round(width / 124), 8, 13);
        this.cellHeight = Math.round(this.cellWidth * 1.45);
        this.columns = Math.ceil(width / this.cellWidth);
        this.rows = Math.ceil(height / this.cellHeight);
        this.canvas.width = Math.round(width * dpr);
        this.canvas.height = Math.round(height * dpr);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        const cells = this.columns * this.rows;
        this.energy = new Float32Array(cells);
        this.energyNext = new Float32Array(cells);
        this.heat = new Float32Array(cells);
      }

      render(world, dt) {
        if (this.columns === 0) return;
        this.consumeEvents(world);
        this.depositWake(world);
        this.diffuse(dt);

        const context = this.context;
        const palette = this.palette;
        context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        context.fillStyle = palette.background;
        context.fillRect(0, 0, this.width, this.height);
        this.drawGrid();
        this.drawWake(world.time);

        context.font = `600 ${Math.round(this.cellHeight * 0.74)}px ui-monospace, Menlo, monospace`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        this.drawFish(world);
        this.drawSharks(world);
        this.drawHeat();
      }

      cellIndex(x, y) {
        const column = Math.floor(x / this.cellWidth);
        const row = Math.floor(y / this.cellHeight);
        if (column < 0 || row < 0 || column >= this.columns || row >= this.rows) return -1;
        return row * this.columns + column;
      }

      stamp(field, x, y, radius, amount) {
        const centerColumn = Math.floor(x / this.cellWidth);
        const centerRow = Math.floor(y / this.cellHeight);
        for (let row = centerRow - radius; row <= centerRow + radius; row++) {
          for (let column = centerColumn - radius; column <= centerColumn + radius; column++) {
            if (column < 0 || row < 0 || column >= this.columns || row >= this.rows) continue;
            const distance = Math.hypot(column - centerColumn, (row - centerRow) * 1.4);
            if (distance > radius + 0.5) continue;
            const index = row * this.columns + column;
            field[index] = Math.min(1.6, field[index] + amount * (1 - distance / (radius + 1)));
          }
        }
      }

      consumeEvents(world) {
        for (const event of world.events) {
          if (event.kind === 'eat') {
            this.stamp(this.heat, event.x, event.y, 2, 1);
            this.stamp(this.energy, event.x, event.y, 3, 0.9);
          } else {
            this.stamp(this.energy, event.x, event.y, 6, 1.4);
          }
        }
        world.events.length = 0;
      }

      depositWake(world) {
        for (const fish of world.fish) {
          if (!fish.alive) continue;
          const index = this.cellIndex(fish.x, fish.y);
          if (index >= 0) {
            this.energy[index] = Math.min(1.6, this.energy[index] + 0.012 + fish.alarm * 0.03);
          }
        }
        for (const shark of world.sharks) {
          for (let node = SHARK_NODES - 6; node < SHARK_NODES; node++) {
            const index = this.cellIndex(shark.nodes[node * 2], shark.nodes[node * 2 + 1]);
            if (index >= 0) {
              this.energy[index] = Math.min(
                1.6,
                this.energy[index] + 0.05 + shark.speed * 0.0012,
              );
            }
          }
        }
        if (world.pointer.active) {
          this.stamp(this.energy, world.pointer.x, world.pointer.y, 1, 0.08);
        }
      }

      diffuse(dt) {
        const decay = Math.exp(-dt * 1.5);
        for (let row = 0; row < this.rows; row++) {
          for (let column = 0; column < this.columns; column++) {
            const index = row * this.columns + column;
            const left = column > 0 ? this.energy[index - 1] : this.energy[index];
            const right =
              column < this.columns - 1 ? this.energy[index + 1] : this.energy[index];
            const up = row > 0 ? this.energy[index - this.columns] : this.energy[index];
            const down =
              row < this.rows - 1 ? this.energy[index + this.columns] : this.energy[index];
            this.energyNext[index] =
              (this.energy[index] * 4 + left + right + up + down) * 0.125 * decay;
          }
        }
        const previous = this.energy;
        this.energy = this.energyNext;
        this.energyNext = previous;
        const heatDecay = Math.exp(-dt * 2.2);
        for (let index = 0; index < this.heat.length; index++) this.heat[index] *= heatDecay;
      }

      drawGrid() {
        const context = this.context;
        context.strokeStyle = this.palette.grid;
        context.lineWidth = 1;
        context.beginPath();
        for (let column = 0; column <= this.columns; column++) {
          const x = Math.round(column * this.cellWidth) + 0.5;
          context.moveTo(x, 0);
          context.lineTo(x, this.height);
        }
        for (let row = 0; row <= this.rows; row++) {
          const y = Math.round(row * this.cellHeight) + 0.5;
          context.moveTo(0, y);
          context.lineTo(this.width, y);
        }
        context.stroke();
      }

      drawWake(time) {
        const context = this.context;
        const wake = this.palette.wake;
        const small = Math.max(2, Math.round(this.cellWidth * 0.19));
        for (let index = 0; index < this.energy.length; index++) {
          const energy = this.energy[index];
          if (energy < 0.34) continue;
          const column = index % this.columns;
          const row = (index / this.columns) | 0;
          const alpha = clamp((energy - 0.34) * 1.4, 0.08, 0.9);
          const twinkle = 0.75 + 0.25 * Math.sin(time * 1.4 + hash3(column, row, 23) * TAU);
          context.fillStyle = rgba(wake, (alpha * twinkle).toFixed(3));
          context.fillRect(
            Math.round(column * this.cellWidth + this.cellWidth * 0.66 - small / 2),
            Math.round(row * this.cellHeight + this.cellHeight * 0.64 - small / 2),
            small,
            small,
          );
        }
      }

      drawFish(world) {
        const context = this.context;
        const palette = this.palette;
        for (const fish of world.fish) {
          if (!fish.alive) continue;
          const column = Math.floor(fish.x / this.cellWidth);
          const row = Math.floor(fish.y / this.cellHeight);
          if (column < 0 || row < 0 || column >= this.columns || row >= this.rows) continue;
          const glint = clamp(Math.abs(fish.turn) / 3.5, 0, 1);
          const brightness = clamp(
            0.25 + 0.35 * (fish.depth - 0.55) + 0.4 * Math.max(glint, fish.alarm),
            0.2,
            1,
          );
          context.fillStyle =
            glint > 0.45 || fish.alarm > 0.55
              ? rgba(palette.fishAlarm, brightness.toFixed(3))
              : rgba(palette.fish, brightness.toFixed(3));
          context.fillText(
            glint > 0.45 ? '·' : '-',
            column * this.cellWidth + this.cellWidth / 2,
            row * this.cellHeight + this.cellHeight / 2 + 1,
          );
        }
      }

      buildSpine(shark) {
        const length = shark.length;
        const swim = clamp(shark.speed / 60, 0.4, 1.4);
        for (let node = 0; node < SHARK_NODES; node++) {
          const progress = node / (SHARK_NODES - 1);
          const previous = shark.nodes[Math.max(0, node - 1) * 2];
          const previousY = shark.nodes[Math.max(0, node - 1) * 2 + 1];
          const next = shark.nodes[Math.min(SHARK_NODES - 1, node + 1) * 2];
          const nextY = shark.nodes[Math.min(SHARK_NODES - 1, node + 1) * 2 + 1];
          let tangentX = previous - next;
          let tangentY = previousY - nextY;
          const tangentLength = Math.hypot(tangentX, tangentY) || 1;
          tangentX /= tangentLength;
          tangentY /= tangentLength;
          const amplitude =
            length * 0.05 * (0.1 + 0.9 * Math.pow(progress, 1.8)) * swim;
          const offset = amplitude * Math.sin(shark.phase - progress * 5.2);
          this.spine[node * 2] = shark.nodes[node * 2] - tangentY * offset;
          this.spine[node * 2 + 1] = shark.nodes[node * 2 + 1] + tangentX * offset;
        }
        this.arc[0] = 0;
        for (let node = 1; node < SHARK_NODES; node++) {
          this.arc[node] =
            this.arc[node - 1] +
            Math.hypot(
              this.spine[node * 2] - this.spine[(node - 1) * 2],
              this.spine[node * 2 + 1] - this.spine[(node - 1) * 2 + 1],
            );
        }
        this.arcTotal = this.arc[SHARK_NODES - 1] || 1;
      }

      sampleShark(x, y, shark) {
        let bestDistanceSquared = Infinity;
        let bestProgress = 0;
        let bestSide = 1;
        for (let node = 0; node < SHARK_NODES - 1; node++) {
          const startX = this.spine[node * 2];
          const startY = this.spine[node * 2 + 1];
          const segmentX = this.spine[(node + 1) * 2] - startX;
          const segmentY = this.spine[(node + 1) * 2 + 1] - startY;
          const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY || 1;
          const projection = clamp(
            ((x - startX) * segmentX + (y - startY) * segmentY) /
              segmentLengthSquared,
            0,
            1,
          );
          const nearestX = startX + segmentX * projection;
          const nearestY = startY + segmentY * projection;
          const distanceSquared = (x - nearestX) ** 2 + (y - nearestY) ** 2;
          if (distanceSquared < bestDistanceSquared) {
            bestDistanceSquared = distanceSquared;
            bestProgress =
              (this.arc[node] + projection * Math.sqrt(segmentLengthSquared)) /
              this.arcTotal;
            bestSide =
              segmentX * (y - startY) - segmentY * (x - startX) >= 0 ? 1 : -1;
          }
        }
        return {
          distance: Math.sqrt(bestDistanceSquared),
          progress: clamp(bestProgress, 0, 1),
          side: bestSide,
        };
      }

      drawSharks(world) {
        const context = this.context;
        const palette = this.palette;
        const sharkInk = this.sharkInk;
        for (const shark of world.sharks) {
          this.buildSpine(shark);
          const length = shark.length;
          const settings = SHARK_KINDS[shark.kind] ?? SHARK_KINDS.classic;
          const reach = length * Math.max(0.36, settings.reach + 0.12);
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          for (let node = 0; node < SHARK_NODES; node++) {
            minX = Math.min(minX, this.spine[node * 2]);
            minY = Math.min(minY, this.spine[node * 2 + 1]);
            maxX = Math.max(maxX, this.spine[node * 2]);
            maxY = Math.max(maxY, this.spine[node * 2 + 1]);
          }
          const firstColumn = Math.max(0, Math.floor((minX - reach) / this.cellWidth));
          const lastColumn = Math.min(
            this.columns - 1,
            Math.floor((maxX + reach) / this.cellWidth),
          );
          const firstRow = Math.max(0, Math.floor((minY - reach) / this.cellHeight));
          const lastRow = Math.min(this.rows - 1, Math.floor((maxY + reach) / this.cellHeight));
          const tint = settings.tint.map(
            (channel) => 1 + (channel - 1) * palette.sharkTintStrength,
          );

          for (let row = firstRow; row <= lastRow; row++) {
            for (let column = firstColumn; column <= lastColumn; column++) {
              const centerX = column * this.cellWidth + this.cellWidth / 2;
              const centerY = row * this.cellHeight + this.cellHeight / 2;
              const sample = this.sampleShark(centerX, centerY, shark);
              const bodyWidth = sharkHalfWidth(shark.kind, sample.progress) * length;
              const across = bodyWidth > 0 ? sample.distance / bodyWidth : Infinity;
              const pectoralRoot = 0.15;
              const pectoralTip = 0.55;
              const pectoralReach = length * settings.reach;
              const pectoral =
                sample.progress >= pectoralRoot &&
                sample.progress <= pectoralTip &&
                sample.distance <=
                  pectoralReach *
                    ((sample.progress - pectoralRoot) / (pectoralTip - pectoralRoot));
              const tail =
                sample.progress > 0.88 &&
                sample.distance <= length * 0.14 * ((sample.progress - 0.88) / 0.12);
              const insideBody = across <= 1;
              if (!insideBody && !pectoral && !tail) continue;

              const depthFactor =
                palette.sharkDepthFloor +
                (1 - palette.sharkDepthFloor) * clamp(shark.depth, 0.5, 1.2);
              const shade = insideBody
                ? clamp(
                    0.66 -
                      Math.min(1, across * across) * 0.42 +
                      (sample.side > 0 ? 0.08 : -0.07),
                    0,
                    1,
                  )
                : 0.42;
              const level =
                (palette.sharkBase + shade * palette.sharkRange) * depthFactor;
              const bodyShade = 0.84 + shade * 0.16;
              let red;
              let green;
              let blue;
              if (this.sharkColor === null) {
                red = clamp(Math.round(level * tint[0]), 0, 255);
                green = clamp(Math.round(level * tint[1]), 0, 255);
                blue = clamp(Math.round(level * tint[2] + 5), 0, 255);
              } else {
                const factor = bodyShade * depthFactor;
                red = clamp(Math.round(this.sharkColor[0] * factor), 0, 255);
                green = clamp(Math.round(this.sharkColor[1] * factor), 0, 255);
                blue = clamp(Math.round(this.sharkColor[2] * factor), 0, 255);
              }
              context.fillStyle = `rgb(${red},${green},${blue})`;
              context.fillRect(
                column * this.cellWidth + 1,
                row * this.cellHeight + 1,
                this.cellWidth - 1,
                this.cellHeight - 1,
              );

              const key = hash3(column, row, shark.id);
              const shimmer = hash3(column, row, Math.floor(world.time * 2.4) + shark.id);
              let glyph = SKIN_RAMP[
                clamp(Math.floor((1 - shade) * (SKIN_RAMP.length - 1)), 0, SKIN_RAMP.length - 1)
              ];
              let color = shade > 0.56
                ? sharkInk.sharkTextStrong
                : sharkInk.sharkTextSoft;
              if (insideBody && sample.progress < 0.12 && across > 0.48) {
                glyph = 'o';
                color = sharkInk.sharkEye;
              } else if (insideBody && sample.progress > 0.31 && sample.progress < 0.46 && across < 0.28) {
                glyph = SKIN_RAMP[7 + (key > 0.5 ? 1 : 0)];
                color = sharkInk.sharkPattern;
              } else if (shimmer < 0.055) {
                color = palette.accents[Math.floor(key * palette.accents.length)];
              } else if (shimmer > 0.965) {
                color = sharkInk.sharkSpark;
              }
              context.globalAlpha = depthFactor;
              context.fillStyle = color;
              context.fillText(
                glyph,
                column * this.cellWidth + this.cellWidth / 2,
                row * this.cellHeight + this.cellHeight / 2 + 1,
              );
              context.globalAlpha = 1;
            }
          }
        }
      }

      drawHeat() {
        const context = this.context;
        const palette = this.palette;
        for (let index = 0; index < this.heat.length; index++) {
          const heat = this.heat[index];
          if (heat < 0.08) continue;
          const column = index % this.columns;
          const row = (index / this.columns) | 0;
          context.fillStyle =
            heat > 0.5
              ? rgba(palette.heatHot, heat.toFixed(2))
              : rgba(palette.heatCool, (heat * 1.6).toFixed(2));
          context.fillText(
            heat > 0.6 ? '*' : '·',
            column * this.cellWidth + this.cellWidth / 2,
            row * this.cellHeight + this.cellHeight / 2 + 1,
          );
        }
      }
    }

    const STEP = 1 / 60;
    const MAX_STEPS = 4;

    class OceanEngine {
      constructor(canvas, sharkSpecs, colorScheme = detectColorScheme(), sharkColor = null) {
        this.canvas = canvas;
        this.world = new OceanWorld(sharkSpecs);
        this.colorScheme = normalizeColorScheme(colorScheme);
        this.renderer = new AsciiRenderer(canvas, this.colorScheme, sharkColor);
        this.raf = 0;
        this.last = 0;
        this.accumulator = 0;
        this.visible = !document.hidden;
        this.disposed = false;
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.intersectionObserver = new IntersectionObserver(([entry]) => {
          this.visible = entry.isIntersecting && !document.hidden;
          this.schedule();
        });
        this.resizeObserver.observe(canvas);
        this.intersectionObserver.observe(canvas);
        this.reducedMotion.addEventListener('change', this.onMotionPreference);
        window.addEventListener('pointermove', this.onPointerMove, { passive: true });
        window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
        document.documentElement.addEventListener('pointerleave', this.onPointerLeave);
        window.addEventListener('blur', this.onPointerLeave);
        document.addEventListener('visibilitychange', this.onVisibilityChange);
        this.resize();
        this.schedule();
      }

      setColorScheme(colorScheme) {
        const next = normalizeColorScheme(colorScheme);
        if (next === this.colorScheme) return;
        this.colorScheme = next;
        this.renderer.setColorScheme(next);
        if (this.reducedMotion.matches) this.drawStill();
      }

      setSharkColor(sharkColor) {
        this.renderer.setSharkColor(sharkColor);
        if (this.reducedMotion.matches) this.drawStill();
      }

      destroy() {
        this.disposed = true;
        cancelAnimationFrame(this.raf);
        this.resizeObserver.disconnect();
        this.intersectionObserver.disconnect();
        this.reducedMotion.removeEventListener('change', this.onMotionPreference);
        window.removeEventListener('pointermove', this.onPointerMove);
        window.removeEventListener('pointerdown', this.onPointerDown);
        document.documentElement.removeEventListener('pointerleave', this.onPointerLeave);
        window.removeEventListener('blur', this.onPointerLeave);
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
      }

      resize() {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.renderer.resize(rect.width, rect.height, dpr);
        this.world.resize(
          rect.width,
          rect.height,
          this.renderer.cellWidth,
          this.renderer.cellHeight,
        );
        if (this.reducedMotion.matches) this.drawStill();
      }

      schedule() {
        cancelAnimationFrame(this.raf);
        if (this.disposed || !this.visible || this.reducedMotion.matches) return;
        this.last = performance.now();
        this.raf = requestAnimationFrame(this.frame);
      }

      frame = (now) => {
        const dt = Math.min(0.1, (now - this.last) / 1000);
        this.last = now;
        this.accumulator += dt;
        let steps = 0;
        while (this.accumulator >= STEP && steps < MAX_STEPS) {
          this.world.step(STEP);
          this.accumulator -= STEP;
          steps++;
        }
        if (steps === MAX_STEPS) this.accumulator = 0;
        this.renderer.render(this.world, dt);
        if (this.visible && !this.reducedMotion.matches && !this.disposed) {
          this.raf = requestAnimationFrame(this.frame);
        }
      };

      drawStill() {
        if (this.world.time < 4) {
          for (let index = 0; index < 240; index++) this.world.step(STEP);
        }
        this.renderer.render(this.world, STEP);
      }

      onMotionPreference = () => {
        if (this.reducedMotion.matches) {
          cancelAnimationFrame(this.raf);
          this.drawStill();
        } else {
          this.schedule();
        }
      };

      onVisibilityChange = () => {
        this.visible = !document.hidden;
        this.schedule();
      };

      toLocal(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        return {
          x,
          y,
          inside: x >= 0 && y >= 0 && x <= rect.width && y <= rect.height,
        };
      }

      onPointerMove = (event) => {
        const { x, y, inside } = this.toLocal(event);
        this.world.pointer.x = x;
        this.world.pointer.y = y;
        this.world.pointer.active = inside && event.pointerType !== 'touch';
      };

      onPointerDown = (event) => {
        const { x, y, inside } = this.toLocal(event);
        if (inside && !this.reducedMotion.matches) this.world.splash(x, y);
      };

      onPointerLeave = () => {
        this.world.pointer.active = false;
      };
    }

    function installStyles() {
      if (document.getElementById(STYLE_ID) !== null) return;
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        body.${ACTIVE_CLASS} { background: #f9fafb !important; }
        body.${ACTIVE_CLASS}[data-ds-dark-theme] { background: #020408 !important; }
        body > canvas[data-dsh-ocean-canvas] {
          position: fixed;
          inset: 0;
          z-index: 0;
          display: block;
          width: 100vw;
          height: 100vh;
          background: #f9fafb;
          pointer-events: none;
        }
        body[data-ds-dark-theme] > canvas[data-dsh-ocean-canvas] { background: #020408; }
        body.${ACTIVE_CLASS} #root {
          position: relative;
          z-index: 1;
          background: transparent !important;
        }
        [${FRAME_ATTRIBUTE}] {
          --dsh-ocean-panel-alpha: 0.78;
          --dsh-ocean-sidebar-alpha: 0.84;
          --dsh-ocean-panel: rgba(249, 250, 252, var(--dsh-ocean-panel-alpha));
          --dsh-ocean-sidebar: rgba(244, 247, 250, var(--dsh-ocean-sidebar-alpha));
          --dsw-alias-bg-base: var(--dsh-ocean-panel);
          --dsw-specific-sidebar-fill: var(--dsh-ocean-sidebar);
          background: transparent !important;
        }
        body[data-ds-dark-theme] [${FRAME_ATTRIBUTE}] {
          --dsh-ocean-panel: rgba(17, 21, 28, var(--dsh-ocean-panel-alpha));
          --dsh-ocean-sidebar: rgba(14, 19, 26, var(--dsh-ocean-sidebar-alpha));
        }
        [${FRAME_ATTRIBUTE}] [class*="sidebarCol"] {
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        @media (prefers-reduced-motion: reduce) {
          [${FRAME_ATTRIBUTE}] [class*="sidebarCol"] {
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
          }
        }
      `;
      document.head.append(style);
    }

    function useConfig() {
      const [config, setConfig] = useState(currentConfig);
      useEffect(() => subscribeConfig(setConfig), []);
      return config;
    }

    function useColorScheme() {
      const [colorScheme, setColorScheme] = useState(currentColorScheme);
      useEffect(() => subscribeColorScheme(setColorScheme), []);
      return colorScheme;
    }

    function OceanBackgroundLayer() {
      const config = useConfig();
      const colorScheme = useColorScheme();
      const anchorRef = useRef(null);
      const canvasRef = useRef(null);
      const engineRef = useRef(null);

      useEffect(() => {
        installStyles();
        const anchor = anchorRef.current;
        const overlay = anchor?.closest('[data-shell-overlay]');
        const frame = overlay?.parentElement;
        if (frame === null || frame === undefined || !config.enabled) return undefined;

        frame.setAttribute(FRAME_ATTRIBUTE, '');
        const panelOpacity = config.panelOpacity;
        frame.style.setProperty(
          '--dsh-ocean-panel-alpha',
          panelOpacity.toFixed(3),
        );
        frame.style.setProperty(
          '--dsh-ocean-sidebar-alpha',
          Math.min(0.96, panelOpacity + 0.06).toFixed(3),
        );
        return () => {
          frame.removeAttribute(FRAME_ATTRIBUTE);
          frame.style.removeProperty('--dsh-ocean-panel-alpha');
          frame.style.removeProperty('--dsh-ocean-sidebar-alpha');
        };
      }, [config.enabled, config.panelOpacity]);

      useEffect(() => {
        if (!config.enabled) return undefined;
        const preset = SHARK_PRESETS[config.preset] ?? SHARK_PRESETS.classics;
        const canvas = document.createElement('canvas');
        canvas.dataset.dshOceanCanvas = '';
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.opacity = String(config.canvasOpacity);
        canvasRef.current = canvas;
        document.body.classList.add(ACTIVE_CLASS);
        document.body.insertBefore(canvas, document.getElementById('root'));
        const engine = new OceanEngine(canvas, preset.sharks, colorScheme, config.sharkColor);
        engineRef.current = engine;
        return () => {
          engine.destroy();
          engineRef.current = null;
          canvas.remove();
          canvasRef.current = null;
          document.body.classList.remove(ACTIVE_CLASS);
        };
      }, [
        config.enabled,
        config.preset,
        config.generation,
      ]);

      useEffect(() => {
        engineRef.current?.setColorScheme(colorScheme);
      }, [colorScheme]);

      useEffect(() => {
        engineRef.current?.setSharkColor(config.sharkColor);
      }, [config.sharkColor]);

      useEffect(() => {
        if (canvasRef.current !== null) {
          canvasRef.current.style.opacity = String(config.canvasOpacity);
        }
      }, [config.canvasOpacity]);

      return h('div', {
        ref: anchorRef,
        'aria-hidden': 'true',
        style: { display: 'none', pointerEvents: 'none' },
      });
    }

    const rowStyle = {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      minHeight: '40px',
    };
    const labelStyle = {
      flex: '1 1 auto',
      minWidth: 0,
      color: 'var(--dsw-alias-label-primary)',
      fontSize: '14px',
    };
    const noteStyle = {
      marginTop: '3px',
      color: 'var(--dsw-alias-label-tertiary)',
      fontSize: '12px',
      lineHeight: 1.5,
    };
    const controlStyle = {
      height: '32px',
      padding: '0 9px',
      border: '1px solid var(--dsw-alias-border-l2)',
      borderRadius: '7px',
      background: 'var(--dsw-alias-bg-layer-1)',
      color: 'var(--dsw-alias-label-primary)',
      font: 'inherit',
      fontSize: '13px',
      whiteSpace: 'nowrap',
    };

    function OceanSettingsPanel() {
      const config = useConfig();
      const colorScheme = useColorScheme();
      const [draft, setDraft] = useState(config);
      useEffect(() => setDraft(config), [config]);
      const setField = useCallback((field, value) => {
        const next = normalizeConfig({ ...draft, [field]: value });
        setDraft(next);
        updateConfig(next);
      }, [draft]);
      const regenerate = useCallback(() => {
        updateConfig({ generation: currentConfig.generation + 1 });
      }, []);
      const sharkColorValue =
        draft.sharkColor ?? (colorScheme === 'dark' ? '#4f5b66' : '#f4f7f9');

      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '720px' } },
        h(
          'div',
          null,
          h('div', { style: { fontSize: '16px', fontWeight: 600 } }, '海洋背景'),
          h(
            'div',
            { style: noteStyle },
            '基于 ascii-sharks 的人工生命海洋：鱼群会避让鲨鱼和鼠标，点击背景会触发水面扰动。',
          ),
          h(
            'div',
            { style: noteStyle },
            '配色自动跟随「通用 → 外观」；选择跟随系统时，会随系统深浅色实时切换。',
          ),
        ),
        h(
          'label',
          { style: rowStyle },
          h(
            'span',
            { style: labelStyle },
            '启用动态背景',
            h('div', { style: noteStyle }, '关闭后恢复 DSH 原有背景，并释放 Canvas 动画。'),
          ),
          h('input', {
            type: 'checkbox',
            checked: draft.enabled,
            onChange: (event) => setField('enabled', event.target.checked),
          }),
        ),
        h(
          'label',
          { style: rowStyle },
          h(
            'span',
            { style: labelStyle },
            '鲨鱼场景',
            h('div', { style: noteStyle }, '切换场景会重新生成鱼群和鲨鱼。'),
          ),
          h(
            'select',
            {
              value: draft.preset,
              style: { ...controlStyle, minWidth: '150px' },
              onChange: (event) => setField('preset', event.target.value),
            },
            ...Object.entries(SHARK_PRESETS).map(([id, preset]) =>
              h('option', { key: id, value: id }, preset.label),
            ),
          ),
        ),
        h(
          'div',
          { style: rowStyle },
          h(
            'span',
            { style: labelStyle },
            '鲨鱼主体色',
            h(
              'div',
              { style: noteStyle },
              '默认跟随主题：黑色保持现有配色，白色使用白色主体；选择颜色后会同时覆盖两种外观。',
            ),
          ),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            h('input', {
              type: 'color',
              value: sharkColorValue,
              'aria-label': '鲨鱼主体色',
              onChange: (event) => setField('sharkColor', event.target.value),
              style: {
                width: '38px',
                height: '32px',
                padding: '2px',
                border: '1px solid var(--dsw-alias-border-l2)',
                borderRadius: '7px',
                background: 'var(--dsw-alias-bg-layer-1)',
                cursor: 'pointer',
              },
            }),
            h(
              'button',
              {
                type: 'button',
                disabled: draft.sharkColor === null,
                onClick: () => setField('sharkColor', null),
                style: {
                  ...controlStyle,
                  cursor: draft.sharkColor === null ? 'default' : 'pointer',
                  opacity: draft.sharkColor === null ? 0.5 : 1,
                },
              },
              '跟随主题',
            ),
          ),
        ),
        h(
          'label',
          { style: rowStyle },
          h(
            'span',
            { style: labelStyle },
            '背景亮度',
            h('div', { style: noteStyle }, '降低亮度可以让前台文字更安静。'),
          ),
          h('input', {
            type: 'range',
            min: '0.35',
            max: '1',
            step: '0.01',
            value: draft.canvasOpacity,
            onChange: (event) => setField('canvasOpacity', Number(event.target.value)),
          }),
          h('span', { style: { width: '42px', textAlign: 'right', fontSize: '12px' } },
            `${Math.round(draft.canvasOpacity * 100)}%`),
        ),
        h(
          'label',
          { style: rowStyle },
          h(
            'span',
            { style: labelStyle },
            '面板不透明度',
            h('div', { style: noteStyle }, '面板越透明，背后的鱼群越明显；过低会影响可读性。'),
          ),
          h('input', {
            type: 'range',
            min: '0.5',
            max: '0.96',
            step: '0.01',
            value: draft.panelOpacity,
            onChange: (event) => setField('panelOpacity', Number(event.target.value)),
          }),
          h('span', { style: { width: '42px', textAlign: 'right', fontSize: '12px' } },
            `${Math.round(draft.panelOpacity * 100)}%`),
        ),
        h(
          'div',
          { style: rowStyle },
          h(
            'span',
            { style: labelStyle },
            '重新生成',
            h('div', { style: noteStyle }, '保留当前设置，重新播种一次海洋生态。'),
          ),
          h(
            'button',
            {
              type: 'button',
              onClick: regenerate,
              style: { ...controlStyle, cursor: 'pointer' },
            },
            '重新播种',
          ),
        ),
      );
    }

    function apply(ctx) {
      ctx.effect(() => {
        const syncTheme = (snapshot) => updateColorScheme(snapshot?.active?.colorScheme);
        syncTheme(ctx.theme.getTheme());
        return ctx.on('theme/change', syncTheme);
      }, 'ocean-background: follow theme');

      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'dsh-ocean-background-layer',
            order: 0,
          },
          OceanBackgroundLayer,
        ),
      );
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'dsh-ocean-background',
            order: 23,
            label: () => '海洋背景',
            inject: () => ({}),
          },
          OceanSettingsPanel,
        ),
      );
    }

    return { name: 'dsh-ocean-background', inject: ['slots', 'theme'], apply };
  },
});
