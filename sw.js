const cacheName = "threejs-editor-vite-v2";

const assets = [
  "./",
  "./manifest.json",
  "./images/icon.png",
  "./images/rotate.svg",
  "./images/scale.svg",
  "./images/translate.svg",
  "./css/main.css",
  "./js/libs/codemirror/codemirror.css",
  "./js/libs/codemirror/addon/show-hint.css",
  "./js/libs/codemirror/addon/tern.css",
  "./js/libs/codemirror/addon/dialog.js",
  "./js/libs/codemirror/addon/show-hint.js",
  "./js/libs/codemirror/addon/tern.js",
  "./js/libs/acorn/acorn.js",
  "./js/libs/acorn/acorn_loose.js",
  "./js/libs/acorn/walk.js",
  "./js/libs/ternjs/polyfill.js",
  "./js/libs/ternjs/signal.js",
  "./js/libs/ternjs/tern.js",
  "./js/libs/ternjs/def.js",
  "./js/libs/ternjs/comment.js",
  "./js/libs/ternjs/infer.js",
  "./js/libs/ternjs/doc_comment.js",
  "./js/libs/tern-threejs/threejs.js",
  "./js/libs/signals.min.js",
  "./js/libs/ui.js",
  "./js/libs/ui.three.js",
  "./js/libs/app.js",
  "./js/Player.js",
  "./js/Script.js",
  "./css/main.css",
  "./js/EditorControls.js",
  "./js/Storage.js",
  "./js/Editor.js",
  "./js/Config.js",
  "./js/History.js",
  "./js/Loader.js",
  "./js/LoaderUtils.js",
  "./js/Menubar.js",
  "./js/Menubar.File.js",
  "./js/Menubar.Edit.js",
  "./js/Menubar.Add.js",
  "./js/Menubar.Help.js",
  "./js/Menubar.View.js",
  "./js/Menubar.Status.js",
  "./js/Resizer.js",
  "./js/Selector.js",
  "./js/Sidebar.js",
  "./js/Sidebar.Scene.js",
  "./js/Sidebar.Project.js",
  "./js/Sidebar.Project.Renderer.js",
  "./js/Sidebar.Project.Materials.js",
  "./js/Sidebar.Project.App.js",
  "./js/Sidebar.Project.Image.js",
  "./js/Sidebar.Project.Video.js",
  "./js/Sidebar.Settings.js",
  "./js/Sidebar.Settings.History.js",
  "./js/Sidebar.Settings.Shortcuts.js",
  "./js/Sidebar.Properties.js",
  "./js/Sidebar.Object.js",
  "./js/Sidebar.Object.Animation.js",
  "./js/Sidebar.Geometry.js",
  "./js/Sidebar.Geometry.BufferGeometry.js",
  "./js/Sidebar.Geometry.Modifiers.js",
  "./js/Sidebar.Geometry.BoxGeometry.js",
  "./js/Sidebar.Geometry.CapsuleGeometry.js",
  "./js/Sidebar.Geometry.CircleGeometry.js",
  "./js/Sidebar.Geometry.CylinderGeometry.js",
  "./js/Sidebar.Geometry.DodecahedronGeometry.js",
  "./js/Sidebar.Geometry.ExtrudeGeometry.js",
  "./js/Sidebar.Geometry.IcosahedronGeometry.js",
  "./js/Sidebar.Geometry.LatheGeometry.js",
  "./js/Sidebar.Geometry.OctahedronGeometry.js",
  "./js/Sidebar.Geometry.PlaneGeometry.js",
  "./js/Sidebar.Geometry.RingGeometry.js",
  "./js/Sidebar.Geometry.SphereGeometry.js",
  "./js/Sidebar.Geometry.ShapeGeometry.js",
  "./js/Sidebar.Geometry.TetrahedronGeometry.js",
  "./js/Sidebar.Geometry.TorusGeometry.js",
  "./js/Sidebar.Geometry.TorusKnotGeometry.js",
  "./js/Sidebar.Geometry.TubeGeometry.js",
  "./js/Sidebar.Material.js",
  "./js/Sidebar.Material.BooleanProperty.js",
  "./js/Sidebar.Material.ColorProperty.js",
  "./js/Sidebar.Material.ConstantProperty.js",
  "./js/Sidebar.Material.MapProperty.js",
  "./js/Sidebar.Material.NumberProperty.js",
  "./js/Sidebar.Material.Program.js",
  "./js/Sidebar.Script.js",
  "./js/Strings.js",
  "./js/Toolbar.js",
  "./js/Viewport.js",
  "./js/Viewport.Controls.js",
  "./js/Viewport.Info.js",
  "./js/Viewport.ViewHelper.js",
  "./js/Viewport.XR.js",
  "./js/Command.js",
  "./js/commands/AddObjectCommand.js",
  "./js/commands/RemoveObjectCommand.js",
  "./js/commands/MoveObjectCommand.js",
  "./js/commands/SetPositionCommand.js",
  "./js/commands/SetRotationCommand.js",
  "./js/commands/SetScaleCommand.js",
  "./js/commands/SetValueCommand.js",
  "./js/commands/SetUuidCommand.js",
  "./js/commands/SetColorCommand.js",
  "./js/commands/SetGeometryCommand.js",
  "./js/commands/SetGeometryValueCommand.js",
  "./js/commands/MultiCmdsCommand.js",
  "./js/commands/AddScriptCommand.js",
  "./js/commands/RemoveScriptCommand.js",
  "./js/commands/SetScriptValueCommand.js",
  "./js/commands/SetMaterialCommand.js",
  "./js/commands/SetMaterialColorCommand.js",
  "./js/commands/SetMaterialMapCommand.js",
  "./js/commands/SetMaterialValueCommand.js",
  "./js/commands/SetMaterialVectorCommand.js",
  "./js/commands/SetSceneCommand.js",
  "./js/commands/Commands.js",
  "./examples/arkanoid.app.json",
  "./examples/camera.app.json",
  "./examples/particles.app.json",
  "./examples/pong.app.json",
  "./examples/shaders.app.json",
];

self.addEventListener("install", async function () {
  const cache = await caches.open(cacheName);

  assets.forEach(async function (asset) {
    try {
      await cache.add(asset);
    } catch {
      console.warn("[SW] Couldn't cache:", asset);
    }
  });
});

self.addEventListener("fetch", async function (event) {
  const request = event.request;

  if (request.url.startsWith("chrome-extension")) return;

  event.respondWith(networkFirst(request));
});

self.addEventListener("activate", async function (event) {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== cacheName) {
            console.log("[SW] Removing old cache", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

async function networkFirst(request) {
  try {
    let response = await fetch(request);

    if (
      request.url.endsWith("editor/") ||
      request.url.endsWith("editor/index.html")
    ) {
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
      newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

      response = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    if (request.method === "GET") {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cachedResponse = await caches.match(request);

    if (cachedResponse === undefined) {
      console.warn("[SW] Not cached:", request.url);
    }

    return cachedResponse;
  }
}
