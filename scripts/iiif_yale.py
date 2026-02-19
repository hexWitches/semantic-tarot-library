from iiif_download import IIIFManifest, config, Config

# Override the default configuration
config.max_size = 2500
config.img_dir = "ViscontiTarot"

manifest_url_yale = "https://collections.library.yale.edu/manifests/33220491"

# Use global config
manifest = IIIFManifest(manifest_url_yale)


# Download images from Yale University Library inside img_dir/dir_name
manifest.download(save_dir="ViscontiTarot")
