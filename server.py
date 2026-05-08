import configparser
import json
import os
import logging

from bottle import route, run, request, response, hook
from gdal_interfaces import GDALTileInterface


logging.basicConfig(level=os.getenv('LOG_LEVEL', 'INFO').upper(), format='%(asctime)s %(levelname)s %(name)s: %(message)s')
logger = logging.getLogger(__name__)

class InternalException(ValueError):
    """
    Utility exception class to handle errors internally and return error codes to the client
    """
    pass

print('Reading config file ...')
parser = configparser.ConfigParser()
parser.read('config.ini')

HOST = parser.get('server', 'host')
PORT = parser.getint('server', 'port')
NUM_WORKERS = parser.getint('server', 'workers')
DATA_FOLDER = parser.get('server', 'data-folder')
OPEN_INTERFACES_SIZE = parser.getint('server', 'open-interfaces-size')
URL_ENDPOINT = parser.get('server', 'endpoint')
ALWAYS_REBUILD_SUMMARY = parser.getboolean('server', 'always-rebuild-summary')
CERTS_FOLDER = parser.get('server', 'certs-folder')
CERT_FILE = '%s/cert.crt' % CERTS_FOLDER
KEY_FILE = '%s/cert.key' % CERTS_FOLDER


"""
Initialize a global interface. This can grow quite large, because it has a cache.
"""
interface = GDALTileInterface(DATA_FOLDER, '%s/summary.json' % DATA_FOLDER, OPEN_INTERFACES_SIZE)

health_report = interface.dataset_health_report()
logger.info(
    'GeoTIFF dataset health check: folder=%s files=%s total_size_mb=%s',
    health_report['tiles_folder'],
    health_report['file_count'],
    health_report['total_size_mb']
)
if health_report['file_count'] == 0:
    logger.warning('No .tif files found in dataset folder=%s', health_report['tiles_folder'])
else:
    logger.info(
        'GeoTIFF file list sample (%s/%s): %s%s',
        len(health_report['file_list']),
        health_report['file_count'],
        ', '.join(health_report['file_list']),
        ' ...' if health_report['file_list_truncated'] else ''
    )

if interface.has_summary_json() and not ALWAYS_REBUILD_SUMMARY:
    print('Re-using existing summary JSON')
    interface.read_summary_json()
else:
    print('Creating summary JSON ...')
    interface.create_summary_json()
logger.info('Dataset initialized from folder=%s with %s indexed tile(s)', DATA_FOLDER, len(getattr(interface, 'all_coords', [])))

def get_elevation(lat, lng):
    """
    Get the elevation at point (lat,lng) using the currently opened interface
    :param lat:
    :param lng:
    :return:
    """
    try:
        elevation = interface.lookup(lat, lng)
    except Exception as e:
        logger.exception('Elevation lookup failed for lat=%s lng=%s: %s', lat, lng, e)
        return {
            'latitude': lat,
            'longitude': lng,
            'error': 'No such coordinate (%s, %s)' % (lat, lng)
        }

    return {
        'latitude': lat,
        'longitude': lng,
        'elevation': elevation
    }


@hook('after_request')
def enable_cors():
    """
    Enable CORS support.
    :return:
    """
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'PUT, GET, POST, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token'


def lat_lng_from_location(location_with_comma):
    """
    Parse the latitude and longitude of a location in the format "xx.xxx,yy.yyy" (which we accept as a query string)
    :param location_with_comma:
    :return:
    """
    try:
        lat, lng = [float(i) for i in location_with_comma.split(',')]
        return lat, lng
    except:
        raise InternalException(json.dumps({'error': 'Bad parameter format "%s".' % location_with_comma}))


def query_to_locations():
    """
    Grab a list of locations from the query and turn them into [(lat,lng),(lat,lng),...]
    :return:
    """
    locations = request.query.locations
    if not locations:
        raise InternalException(json.dumps({'error': '"Locations" is required.'}))

    return [lat_lng_from_location(l) for l in locations.split('|')]


def body_to_locations():
    """
    Grab a list of locations from the body and turn them into [(lat,lng),(lat,lng),...]
    :return:
    """
    try:
        locations = request.json.get('locations', None)
    except Exception:
        raise InternalException(json.dumps({'error': 'Invalid JSON.'}))

    if not locations:
        raise InternalException(json.dumps({'error': '"Locations" is required in the body.'}))

    latlng = []
    for l in locations:
        try:
            latlng += [ (l['latitude'],l['longitude']) ]
        except KeyError:
            raise InternalException(json.dumps({'error': '"%s" is not in a valid format.' % l}))

    return latlng


def do_lookup(get_locations_func):
    """
    Generic method which gets the locations in [(lat,lng),(lat,lng),...] format by calling get_locations_func
    and returns an answer ready to go to the client.
    :return:
    """
    try:
        locations = get_locations_func()
        logger.info('Incoming lookup request with %s location(s)', len(locations))
        return {'results': [get_elevation(lat, lng) for (lat, lng) in locations]}
    except InternalException as e:
        response.status = 400
        response.content_type = 'application/json'
        return e.args[0]

# For CORS
@route(URL_ENDPOINT, method=['OPTIONS'])
def cors_handler():
    return {}

@route(URL_ENDPOINT, method=['GET'])
def get_lookup():
    """
    GET method. Uses query_to_locations.
    :return:
    """
    return do_lookup(query_to_locations)


@route(URL_ENDPOINT, method=['POST'])
def post_lookup():
    """
    GET method. Uses body_to_locations.
    :return:
    """
    return do_lookup(body_to_locations)

if os.path.isfile(CERT_FILE) and os.path.isfile(KEY_FILE):
    print('Using HTTPS')
    run(host=HOST, port=PORT, server='gunicorn', workers=NUM_WORKERS, certfile=CERT_FILE, keyfile=KEY_FILE)
else:
    print('Using HTTP')
    run(host=HOST, port=PORT, server='gunicorn', workers=NUM_WORKERS)
