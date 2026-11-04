# Attribution

## Anatomy data

**BodyParts3D**, © The Database Center for Life Science, licensed under
[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

- License page: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html
- Dataset: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- Publication: Mitsuhashi N. et al. (2009). BodyParts3D: 3D structure database for anatomical concepts.
  _Nucleic Acids Research_ 37, D782–D785. https://doi.org/10.1093/nar/gkn613

**Adaptations.** We use the browser-ready geometry prepared by the
[human-atlas](https://github.com/ashemag/human-atlas) project (commit `1c38bf3`). The project
converted the source from millimetres and Z-up to metres and Y-up, simplified each mesh with
meshoptimizer (0.2% relative error limit), quantised normals to 16-bit, packed the meshes into 15
binary chunks, and grouped structures into display systems with curated colours. All 2,234 source
meshes and 3,432 named FMA concepts are kept. We do not modify the geometry further.

BodyParts3D represents one adult male reference anatomy. It does not include every human structure
or variation.

## Code

Parts of the 3D viewer (`src/viewer/`) are adapted from
[human-atlas](https://github.com/ashemag/human-atlas), MIT License, Copyright (c) 2026 ashemag.
The full license text is in `src/viewer/LICENSE.human-atlas`.

Our own code is MIT licensed, Copyright (c) 2026 Mohith DK.

## Educational use

This is an educational tool. It is not a diagnostic, clinical or surgical reference.
