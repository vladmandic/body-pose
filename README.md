# Advanced 3D Body Pose Analysis

[**Live Demo**](https://vladmandic.github.io/human-pose/client/index.html)  
*Note: Live demo uses pre-rendered data from sample images and videos*  

<br>

This solution is in two parts
- Processing using **Python** and **TensorFlow** framework
- 3D Visualization using **JavaScript** and **BabylonJS**

<br>

![**Screenshot-Fitness**](assets/screenshot-fitness.jpg)
![**Screenshot-Basketball**](assets/screenshot-basketball.jpg)
![**Screenshot-Dance**](assets/screenshot-dance.jpg)

<br>

## Requirements

TensorFlow with CUDA for GPU acceleration  
Note that models used here are S.O.T.A. and computationally intensive thus requiring GPU with sufficient memory:
- [**Tiny**](https://omnomnom.vision.rwth-aachen.de/data/metrabs/metrabs_mob3l_y4t_20211019.zip) (using MobileNetV3 backbone with YOLOv4-Tiny detector) => 2GB
- [**Small**](https://omnomnom.vision.rwth-aachen.de/data/metrabs/metrabs_eff2s_y4_20211026.zip) (using EfficientNetV2 backbone with YOLOv4 detector) => 4GB (6GB recommended)
- [**Large**](https://omnomnom.vision.rwth-aachen.de/data/metrabs/metrabs_eff2l_y4_20211019.zip) (using EfficientNetV2 backbone with YOLOv4 detector) => 8GB (10GB recommended)
- [**Large 360**](https://omnomnom.vision.rwth-aachen.de/data/metrabs/metrabs_eff2l_y4_360_20211019.zip) (same as large but tuned for occluded body parts) => 8GB (12GB recommended)
## Usage

- [**Output Specs**](client/types.ts) (e.g. json format used)
- [**Constants**](client/constants.ts) (e.g., skeleton definitions with joints and connected edges)
### Process

> process.py

    arguments:
      --help                show this help message
      --image               image file
      --video               video file
      --json                write results to json file
      --round               round coordiantes in json outputs
      --minify              minify json output
      --verbose             verbose logging
      --model               model used for predictions
      --skipms              skip time between frames in miliseconds
      --plot                plot output when processing image
      --fov                 field-of-view in degrees
      --batch               process n detected people in parallel
      --maxpeople           limit processing to n people in the scene
      --skeleton            use specific skeleton definition standard
      --augmentations       how many variations of detection to run
      --average             run avarage on augmentation variations
      --suppress            suppress implausible poses
      --minconfidence       minimum detection confidence
      --iou                 iou threshold for overlaps

### Example

*Using default model and processing parameters*

> ./process.py --model models/tiny --video media/BaseballPitchSlowMo.webm --maxpeople 1 --augmentations 1 --json output.json

    options: image:null video:media/BaseballPitchSlowMo.webm json:output.json verbose:1 model:models/tiny skipms:0 plot:0 fov:55 batch:64 maxpeople:1 skeleton: augmentations:1 average:1 suppress:1 round:1 minify:1 minconfidence:0.1 iou:0.7

    loaded tensorflow 2.7.0
    loaded cuda 11.2
    loaded model: models/tiny in 27.8sec
    loaded video: media/BaseballPitchSlowMo.webm  frames: 720  resolution: 1080 x 1080
    processed video: 720 frames in 67.8sec
    results written to: output.json

<br>

### Visualize

> npm run dev  
<https://localhost:8001>

## ToDo

- Create process server to process data on demand
- Use animation instead of updating meshes
- Dynamic tube radius and sphere diameter
- Implement avatar animation with bones using inverse kinematics

<br>

## Credits

- [MeTRAbs Absolute 3D Human Pose Estimator](https://github.com/isarandi/metrabs)
