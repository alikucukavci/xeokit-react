import { useRef, useEffect, useState } from 'react';
import {
  createMap,
  defaultLoaders,
  getExtension,
  moveCamera,
  setSpaceVisibility,
  setVisibilityAndAABB,
} from './utils';
import difference from 'lodash.difference';

const usePreviousModels = (models, viewer, setModelsHaveLoaded) => {
  const ref = useRef([]);

  useEffect(() => {
    if (viewer) {
      ref.current = models;
    } else {
      ref.current = [];
      setModelsHaveLoaded(false);
    }
  }, [viewer, models, setModelsHaveLoaded]);

  return ref.current;
};

export const useLoaders = (
  viewer,
  models,
  loaders = defaultLoaders,
  pickedEntity,
  setPickedEntity,
  flyToModels,
  roomMode,
  setContainsSpace
) => {
  // A piece of state that tells us if the models have been loaded
  const [modelsHaveLoaded, setModelsHaveLoaded] = useState(false);
  const prevModels = usePreviousModels(models, viewer, setModelsHaveLoaded);

  const modelsAABB = useRef(Object.create(null));
  const spaceMap = useRef(Object.create(null));

  const calculateSpace = () =>
    setContainsSpace(
      Object.values(spaceMap.current).some(spaces => spaces.length)
    );

  useEffect(() => {
    if (viewer) {
      const modelIds = models.map(({ id }) => id);
      const prevModelIds = prevModels.map(({ id }) => id);

      const toAdd = difference(modelIds, prevModelIds);
      const toRemove = difference(prevModelIds, modelIds);
      const toKeep = difference(prevModelIds, toRemove);

      // Remove models that are no longer needed
      toRemove.forEach(modelId => {
        viewer.scene.models[modelId]?.destroy();
        delete modelsAABB.current[modelId];
        delete spaceMap.current[modelId];
        calculateSpace();
      });

      if (pickedEntity?.model.destroyed) {
        setPickedEntity(null);
      }

      const modelsIdMap = createMap(models, ({ id }) => id);
      const prevModelsIdMap = createMap(prevModels, ({ id }) => id);

      let guidChanged = false;

      // Update models when guids, xrayed or pickable setting changes
      toKeep.forEach(modelId => {
        const update = () => {
          const model = modelsIdMap[modelId];
          const prevModel = prevModelsIdMap[modelId];

          if (model.guids !== prevModel.guids) {
            guidChanged = true;
            setVisibilityAndAABB(viewer.scene, model, modelsAABB.current);
          }

          viewer.scene.models[modelId].xrayed = roomMode ? true : model.xrayed;
          viewer.scene.models[modelId].pickable = roomMode
            ? false
            : model.pickable;

          setSpaceVisibility(
            viewer,
            model,
            roomMode,
            spaceMap.current,
            guidChanged
          );
          calculateSpace();
        };

        modelsAABB.current[modelId]
          ? update()
          : viewer.scene.models[modelId].once('loaded', update);
      });

      // Deselect entity when it's no longer visible
      if (pickedEntity && !pickedEntity.visible) {
        pickedEntity.selected = false;
        setPickedEntity(null);
      }

      if ((toRemove.length || guidChanged) && !toAdd.length) {
        moveCamera(viewer, modelsAABB.current, flyToModels);
      }

      if (!toKeep.length || toAdd.length) {
        setModelsHaveLoaded(false);
      }

      if (!toAdd.length) {
        return;
      }

      // Initialise loader plugin (eg. gltfLoader, xktLoader) and load models
      const promises = toAdd.map(
        modelId =>
          new Promise(resolve => {
            const model = modelsIdMap[modelId];
            const { loader: LoaderPlugin, dataSource } =
              loaders[getExtension(model.src)] || {};
            if (!LoaderPlugin) {
              resolve();
              return;
            }

            const loader =
              viewer._plugins?.find(p => p instanceof LoaderPlugin) ||
              new LoaderPlugin(viewer, { dataSource });

            const visibilitySettings = model.guids ? { visible: false } : {};
            const modifiers = roomMode ? { xrayed: true, pickable: false } : {};

            const perfModel = loader.load({
              ...model,
              ...visibilitySettings,
              ...modifiers,
            });

            perfModel.once('loaded', () => {
              setSpaceVisibility(viewer, model, roomMode, spaceMap.current);
              calculateSpace();
              setVisibilityAndAABB(
                viewer.scene,
                model,
                modelsAABB.current,
                false
              );
              moveCamera(viewer, modelsAABB.current, flyToModels);
              resolve();
            });
          })
      );

      // once all the models have been loaded and thus all the promises
      // have been resolved, we can finally load our viewpoint
      Promise.all(promises).then(() => setModelsHaveLoaded(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, models, loaders, setModelsHaveLoaded, roomMode]);

  return modelsHaveLoaded;
};
