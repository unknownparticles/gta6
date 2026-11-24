"""Convert OSM API extracts to the game's compact local metre coordinates."""
import argparse
from array import array
import gzip
import json
import math
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import polygonize, unary_union

ORIGIN = (116.697, 23.345)
BOUNDS = (116.638, 23.320, 116.765, 23.369)
FEEDS = [
    (116.638, 23.340, 116.704, 23.369),
    (116.700, 23.318, 116.769, 23.367),
    (116.630, 23.313, 116.704, 23.341),
]
SOURCE = 'https://api.openstreetmap.org/api/0.6/map?bbox='
DEM = 'https://elevation-tiles-prod.s3.us-east-1.amazonaws.com/skadi/N23/N23E116.hgt.gz'
WIDTH = dict(motorway=10, trunk=9, primary=8, secondary=7, tertiary=6, residential=5.5,
             living_street=5, unclassified=5, service=3.6, pedestrian=4,
             footway=2, path=1.5, cycleway=2.4, steps=1.7)


def project(lon, lat):
    return ((lon - ORIGIN[0]) * 102200, (ORIGIN[1] - lat) * 111000)


def geometries(shape, kind):
    if shape.is_empty:
        return
    if shape.geom_type == kind:
        yield shape
    elif hasattr(shape, 'geoms'):
        for child in shape.geoms:
            yield from geometries(child, kind)


def points(sequence):
    return [round(value, 1) for point in sequence for value in point]


def number(value):
    match = re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*(?:m)?\s*', value)
    return float(match[1]) if match else None


def read_terrain(path, bounds):
    samples = array('h')
    with gzip.open(path, 'rb') as source:
        samples.frombytes(source.read())
    if sys.byteorder == 'little':
        samples.byteswap()
    size = math.isqrt(len(samples))
    if size * size != len(samples) or size < 1000:
        raise ValueError('Invalid SRTM grid')
    x1, z1, x2, z2 = bounds
    step = 42
    cols = math.ceil((x2 - x1) / step) + 1
    rows = math.ceil((z2 - z1) / step) + 1
    heights = []
    for j in range(rows):
        for i in range(cols):
            lon = ORIGIN[0] + (x1 + i * step) / 102200
            lat = ORIGIN[1] - (z1 + j * step) / 111000
            col = round((lon - 116) * (size - 1))
            row = round((24 - lat) * (size - 1))
            local = sorted(samples[(row + j) * size + col + i] for i in (-1, 0, 1) for j in (-1, 0, 1))
            # Flatten low coastal terrain and suppress isolated structures in the elevation tile.
            heights.append(max(0, int((local[4] - 17) * 0.88)))
    return dict(step=step, cols=cols, rows=rows, heights=heights, source=DEM)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('extract', type=Path, nargs=3)
    parser.add_argument('--terrain', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('public/maps/inner-bay.json'))
    args = parser.parse_args()
    nodes, ways, trees = {}, {}, {}
    for filename in args.extract:
        root = ET.parse(filename).getroot()
        nodes.update((n.attrib['id'], project(float(n.attrib['lon']), float(n.attrib['lat'])))
                     for n in root.findall('node'))
        for node in root.findall('node'):
            if any(tag.get('k') == 'natural' and tag.get('v') == 'tree' for tag in node.findall('tag')):
                trees[node.attrib['id']] = nodes[node.attrib['id']]
        ways.update((w.attrib['id'], w) for w in root.findall('way'))

    west, south, east, north = BOUNDS
    min_x, min_z = project(west, north)
    max_x, max_z = project(east, south)
    clip = box(min_x, min_z, max_x, max_z)
    coast, inland_water, roads, buildings, places, green = [], [], [], [], {}, []
    for identifier, way in ways.items():
        tag = {t.attrib['k']: t.attrib['v'] for t in way.findall('tag')}
        refs = [nd.attrib['ref'] for nd in way.findall('nd')]
        if len(refs) < 2 or any(ref not in nodes for ref in refs):
            continue
        coords = [nodes[ref] for ref in refs]
        line = LineString(coords)
        if tag.get('natural') == 'coastline':
            coast.extend(geometries(line.intersection(clip), 'LineString'))
        highway = tag.get('highway', '').removesuffix('_link')
        if (highway in WIDTH and tag.get('tunnel', 'no') == 'no'
                and tag.get('area') != 'yes'):
            path = line.simplify(0.55)
            bridge = tag.get('bridge', 'no') not in ('no', 'culvert')
            flags = int(bridge) + (2 if highway in ('path', 'footway', 'steps', 'pedestrian') else 0)
            for part in geometries(path.intersection(clip), 'LineString'):
                roads.append([WIDTH[highway], flags, points(part.coords)])
        if coords[0] != coords[-1] or len(coords) < 4:
            continue
        polygon = Polygon(coords).buffer(0).intersection(clip)
        if tag.get('natural') == 'water':
            inland_water.extend(points(p.exterior.coords[:-1]) for p in geometries(polygon, 'Polygon') if p.area > 350)
        wood = tag.get('natural') in {'wood', 'scrub'} or tag.get('landuse') == 'forest'
        if wood or tag.get('leisure') in {'park', 'garden', 'recreation_ground'} or tag.get('landuse') in {'grass', 'recreation_ground'}:
            green.extend([int(wood), points(p.exterior.coords[:-1])]
                         for p in geometries(polygon.simplify(1), 'Polygon') if p.area > 90)
        if identifier in {'532956287', '527201447', '527264674', '528328082', '534229497', '583148030', '583148033', '527201452'} and not polygon.is_empty:
            places[identifier] = points([polygon.centroid.coords[0]])
        if 'building' in tag and tag['building'] != 'no' and identifier != '532956287':
            height = number(tag.get('height', ''))
            levels = number(tag.get('building:levels', ''))
            for part in geometries(polygon.simplify(0.42), 'Polygon'):
                if part.area < 9:
                    continue
                center = part.centroid
                # In the historic quarter, untagged buildings are typically low-rise.
                old_town = -3500 < center.x < -1700 and -1900 < center.y < -850
                estimate = (8 if old_town else 11) + int(identifier) % (5 if old_town else 14)
                buildings.append([round(min(300, max(2.8, height or ((levels * 3.15) if levels else estimate))), 1),
                                  int(identifier) % 11, points(part.exterior.coords[:-1])])

    # OSM coastlines place land on the left. The local Z axis points south.
    coastline = []
    for segment in coast:
        simple = segment.simplify(0.8)
        coastline.append(simple)
    faces = list(polygonize(unary_union([clip.boundary, *coastline])))
    samples = []
    for line in coastline:
        positions = list(line.coords)
        for a, b in zip(positions, positions[1:]):
            dx, dz = b[0] - a[0], b[1] - a[1]
            length = math.hypot(dx, dz)
            if length > 1:
                midpoint = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
                for side in [-1, 1]:
                    samples.append((Point(midpoint[0] + side * dz / length, midpoint[1] - side * dx / length), side))
    land = []
    for face in faces:
        if sum(side for point, side in samples if face.contains(point)) > 0:
            land.append([points(face.exterior.coords[:-1]), *[points(hole.coords[:-1]) for hole in face.interiors]])
    if len(land) < 2 or not places.get('532956287'):
        raise RuntimeError('Incomplete coastline or missing old-town landmark')
    data = dict(version=1, bounds=points([(min_x, min_z), (max_x, max_z)]),
                source=[SOURCE + ','.join(map(str, bbox)) for bbox in FEEDS],
                land=land, ponds=inland_water, roads=roads, buildings=buildings, places=places,
                green=green, trees=[points([p]) for p in trees.values() if clip.contains(Point(p))])
    args.output.write_text(json.dumps(data, separators=(',', ':')) + '\n')
    terrain = args.output.with_name('inner-bay-elevation.json')
    terrain.write_text(json.dumps(read_terrain(args.terrain, data['bounds']), separators=(',', ':')) + '\n')
    print(f'{len(buildings)} buildings, {len(roads)} roads, {len(land)} land polygons')


if __name__ == '__main__':
    main()
