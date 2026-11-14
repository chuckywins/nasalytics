# body.glb: Attribution & License

`body.glb` is a derivative work, licensed **CC BY-SA 4.0** (https://creativecommons.org/licenses/by-sa/4.0/).

Built by `frontend/scripts/build_body.mjs`, which selects the health-relevant structures (heart chambers, lungs, kidneys, pancreas/liver/stomach, brain, eyes, inner ear, skeleton, major antigravity muscles), simplifies them with meshoptimizer, and merges them into one file.

Upstream chain:
1. **anatomi-simulatoru** by Dr. Murat Altun, https://github.com/DrMuratAltun/anatomi-simulatoru (3D data CC BY-SA 4.0; code MIT). We use only `systems/*.glb` and **not** its brand mark.
2. **Z-Anatomy**, "The libre 3D atlas of anatomy", https://www.z-anatomy.com/ (CC BY-SA 4.0)
3. **BodyParts3D**, © The Database Center for Life Science (DBCLS), https://lifesciencedb.jp/bp3d/ (CC BY-SA 2.1 Japan)

Changes: structure selection, mesh simplification (ratios 0.3–0.6), merge into a single scene, `extras.region` tags. The script was written with AI assistance (Claude, Anthropic).
