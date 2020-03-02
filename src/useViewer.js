// React related imports
import { useState, useMemo, useEffect } from 'react';

// Xeokit related imports
import { Viewer } from '@xeokit/xeokit-sdk/src/viewer/Viewer';
import { NavCubePlugin } from '@xeokit/xeokit-sdk/src/plugins/NavCubePlugin/NavCubePlugin';
import { pickEntity, setCameraPreset, cameraPresets } from './utils';
import { useLoaders } from './loaders';

const faces = cameraPresets.map(({ label }) => label);

const useViewer = (
  models,
  { eventToPickOn = 'mouseclicked', loaders } = {}
) => {
  // A piece of state that returns the picked entity's ID
  const [pickedEntity, setPickedEntity] = useState(null);

  const [viewer, setViewer] = useState(null);

  const modelsHaveLoaded = useLoaders(
    viewer,
    models,
    loaders,
    pickedEntity,
    setPickedEntity
  );

  // Props to use with the viewer canvas
  const viewerCanvasProps = useMemo(
    () => ({
      ref: canvasElement =>
        setViewer(canvasElement ? new Viewer({ canvasElement }) : null),
    }),
    [setViewer]
  );

  // Props to use with the nav cube canvas
  const navCubeCanvasProps = useMemo(
    () => ({
      ref: canvasElement =>
        canvasElement && viewer
          ? new NavCubePlugin(viewer, { canvasElement })
          : viewer && viewer.plugins && viewer.plugins.NavCubePlugin.destroy(),
    }),
    [viewer]
  );

  // Take screenshot feature
  const takeScreenshot = () => {
    if (viewer) {
      const imageData = viewer.getSnapshot({
        format: 'png',
      });

      // The anchor element's download tag enables us to save the
      // screenshot to the file system
      // we don't actually append the link to the page
      // we just call the click event on it to start/prompt the download
      const link = document.createElement('a');
      link.setAttribute('href', imageData);
      link.setAttribute('download', 'model-screenshot');
      link.click();
    }
  };

  useEffect(() => {
    if (viewer) {
      // Initialise xeokit features

      // Pick entities
      pickEntity(viewer, eventToPickOn, setPickedEntity);
    }
    return () => {
      if (viewer) {
        // Clean up entity ID
        setPickedEntity(null);

        // Destroy the viewer
        viewer.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer]);

  return {
    viewerCanvasProps,
    navCubeCanvasProps,
    takeScreenshot,
    setCameraPreset: setCameraPreset(viewer, modelsHaveLoaded),
    pickedEntity: pickedEntity
      ? { entityId: pickedEntity.id, modelId: pickedEntity.model.id }
      : { entityId: '', modelId: '' },
    faces,
  };
};

export default useViewer;
