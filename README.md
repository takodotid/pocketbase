# PocketBase Docker Image

This repository contains the sources for a PocketBase container image.

## Variants

We provide two variants of the image:

### Vanilla
```sh
ghcr.io/takodotid/pocketbase:0.27
```
> This is the vanilla image, it contains the official binary from PocketBase. Including every CPU architecture by their official binary

### Tako
```sh
ghcr.io/takodotid/pocketbase:0.27-tako
```

> This is an extended PocketBase image used by Tako. You can see the source code in the `pb_hooks/` directory.

## Get it
We only publish images to GitHub container registry, you can view it via the packages section on the left side on this repository page, or via [this link](https://github.com/orgs/takodotid/packages?repo_name=pocketbase)