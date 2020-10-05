import { GLTFLoaderPlugin } from '@xeokit/xeokit-sdk/src/plugins/GLTFLoaderPlugin/GLTFLoaderPlugin';
import { XKTLoaderPlugin } from '@xeokit/xeokit-sdk/src/plugins/XKTLoaderPlugin/XKTLoaderPlugin';
import { math } from '@xeokit/xeokit-sdk/src/viewer/scene/math/math';

export const createMap = (array, getKey, value) =>
  array.reduce((acc, item) => {
    acc[getKey ? getKey(item) : item] = value || item;
    return acc;
  }, Object.create(null));

const getSpaces = (metaObject, guids) => {
  if (!metaObject) {
    return [];
  }

  const list = [];

  const guidMap = guids?.length ? createMap(guids, null, true) : {};

  const visit = ({ type, id, children }) => {
    if (type === 'IfcSpace' && (!guids?.length || guidMap[id])) {
      list.push(id);
    }
    if (children) {
      children.forEach(visit);
    }
  };
  visit(metaObject);

  return list;
};

export const setSpaceVisibility = (
  { scene, metaScene },
  { id, guids },
  visible = true,
  spaceMap,
  guidChanged = true
) => {
  const model = scene.models[id];

  if (!spaceMap[id] || guidChanged) {
    spaceMap[id] = getSpaces(metaScene.metaModels[id].rootMetaObject, guids);
  }

  spaceMap[id].forEach(modelId => {
    const entity = model._nodes[modelId];
    if (entity) {
      entity.pickable = true;
      entity.xrayed = false;
      entity.visible = visible;
    }
  });
};

export const setVisibilityAndAABB = (
  scene,
  { id, guids },
  modelsAABB,
  makeModelVisible = true
) => {
  const model = scene.models[id];
  if (guids?.length) {
    const visibilityMap = createMap(guids, null, true);

    modelsAABB[id] = model.entityList.reduce((aabb, node) => {
      const visible = !!visibilityMap[node.id];
      node.visible = visible;
      return visible ? math.expandAABB3(aabb, node.aabb) : aabb;
    }, math.collapseAABB3());
  } else {
    if (makeModelVisible) {
      model.visible = true;
    }
    modelsAABB[id] = model.aabb;
  }
};

export const moveCamera = (viewer, modelsAABB, flyToModels) => {
  const aabbs = Object.values
    ? Object.values(modelsAABB)
    : Object.keys(modelsAABB).map(key => modelsAABB[key]);
  const target = aabbs.reduce(math.expandAABB3, math.collapseAABB3());
  flyToModels
    ? viewer.cameraFlight.flyTo(target)
    : viewer.cameraFlight.jumpTo(target);
};

export const setCamera = (viewer, cameraSettings) => {
  const { camera } = viewer.scene;

  const keys = Object.keys(cameraSettings);

  keys.forEach(key => {
    const prop = camera[key];
    const val = cameraSettings[key];
    if (typeof prop === 'function') {
      prop.call(camera, val);
    } else {
      camera[key] = val;
    }
  });
};

export const defaultLoaders = {
  gltf: { loader: GLTFLoaderPlugin },
  xkt: { loader: XKTLoaderPlugin },
};

export const getExtension = fileName => {
  const extension = fileName.match(/\.(\w+)$/);
  return extension && extension[1].toLowerCase();
};

// camera presets
export const cameraPresets = [
  {
    label: 'front',
    boundaries: [[7, 7, 4, 4]],
    dir: [0, 0, -1],
    up: [0, 1, 0],
  },
  {
    label: 'back',
    boundaries: [[19, 7, 4, 4]],
    dir: [0, 0, 1],
    up: [0, 1, 0],
  },
  {
    label: 'right',
    boundaries: [[13, 7, 4, 4]],
    dir: [-1, 0, 0],
    up: [0, 1, 0],
  },
  {
    label: 'left',
    boundaries: [[1, 7, 4, 4]],
    dir: [1, 0, 0],
    up: [0, 1, 0],
  },
  {
    label: 'top',
    boundaries: [[7, 1, 4, 4]],
    dir: [0, -1, 0],
    up: [0, 0, -1],
  },
  {
    label: 'bottom',
    boundaries: [[7, 13, 4, 4]],
    dir: [0, 1, 0],
    up: [0, 0, 1],
  },
];

// set camera preset
export const setCameraPreset = (viewer, modelsHaveLoaded) => preset => {
  const faceObj = cameraPresets.find(({ label }) => label === preset);

  if (modelsHaveLoaded) {
    const center = math.vec3();
    const { aabb } = viewer.scene;
    const diag = math.getAABB3Diag(aabb);
    math.getAABB3Center(aabb, center);
    const dist = Math.abs(diag / Math.tan(55.0 / 2));

    viewer.cameraFlight.flyTo({
      look: center,
      eye: [
        center[0] - dist * faceObj.dir[0],
        center[1] - dist * faceObj.dir[1],
        center[2] - dist * faceObj.dir[2],
      ],
      up: faceObj.up || [0, 1, 0],
      orthoScale: diag * 1.3,
      fitFOV: 45,
      duration: 0.5,
    });
  }
};

// given an invalid hex value it will return a default green colour
export const hexToRgb = hex => {
  const match = hex.match(/#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i);
  return match ? match.slice(1).map(hex => parseInt(hex, 16) / 255) : [0, 1, 0];
};

export const setProperties = (properties, obj) => {
  if (properties && obj) {
    Object.keys(properties).forEach(option => {
      const value = properties[option];
      if (obj[option] !== value) {
        obj[option] = value;
      }
    });
  }
};
