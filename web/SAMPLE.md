# 示例动画来源

本目录 sample.mp4 是发布时用 FFmpeg lavfi testsrc2 生成的 6 秒测试图案，不是用户导入的视频，不包含人物、照片或录音。

生成命令：

```sh
ffmpeg -f lavfi -i "testsrc2=size=640x360:rate=24" -t 6 -an -c:v libx264 -pix_fmt yuv420p -movflags +faststart sample.mp4
```
