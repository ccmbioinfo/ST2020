from unittest.mock import Mock
from csv import DictReader
from io import StringIO
from pytest import raises

from flask.wrappers import Request
from sqlalchemy.orm import joinedload

from app import models, db
from app.routes import link_files_to_dataset

# GET /api/pipelines


def test_get_pipelines(test_database, client, login_as):
    # Not much to test here, if the endpoint is updated please add more tests
    # Test success
    login_as("admin")
    response = client.get("/api/pipelines")
    assert response.status_code == 200
    assert len(response.get_json()) == 2


# GET /api/enums


def test_get_enums(test_database, client, login_as):
    # Test success
    login_as("admin")
    response = client.get("/api/enums")
    assert response.status_code == 200
    assert len(response.get_json()) == 10
    for enumType, enums in response.get_json().items():
        assert enumType is not None


# GET /api/metadatasettypes
def test_get_metadatasettypes(test_database, client, login_as):
    login_as("admin")
    response = client.get("/api/metadatasettypes")
    assert response.status_code == 200
    assert len(response.get_json()) == 4
    for _, dataset_types in response.get_json().items():
        assert dataset_types is not None and isinstance(dataset_types, list)


# GET api/institutions


def test_get_institutions(test_database, client, login_as):
    login_as("admin")
    response = client.get("/api/institutions")
    assert response.status_code == 200
    assert len(response.get_json()) == 21
    for institution in response.get_json():
        assert institution is not None


# POST /api/_bulk
def test_post_bulk(test_database, client, login_as):
    login_as("admin")
    # Test invalid csv
    badsamplecsv = open("tests/badsamplecsv.csv", "r")
    assert (
        client.post(
            "/api/_bulk",
            data=badsamplecsv.read(),
            headers={"Content-Type": "text/csv"},
        ).status_code
        == 400
    )
    # Test not json array
    assert (
        client.post(
            "/api/_bulk?groups=ach",
            json={
                "family_codename": "1001",
                "participant_codename": "06332",
                "tissue_sample": "Blood",
                "tissue_sample_type": "Blood",
                "dataset_type": "WGS",
                "condition": "GermLine",
                "gender": "Male",
                "participant_type": "Parent",
            },
        ).status_code
        == 422
    )

    # Test enum error
    assert (
        client.post(
            "/api/_bulk?groups=ach",
            json=[
                {
                    "family_codename": "1001",
                    "participant_codename": "ANYTHING ELSE",
                    "tissue_sample": "Blood",
                    "tissue_sample_type": "DEFINITELY NOT AN ENUM",
                    "dataset_type": "WGS",
                    "condition": "GermLine",
                    "gender": "Male",
                    "participant_type": "Parent",
                }
            ],
        ).status_code
        == 400
    )

    # Test json array
    assert (
        client.post(
            "/api/_bulk?groups=ach",
            json=[
                {
                    "family_codename": "1001",
                    "participant_codename": "1411",
                    "tissue_sample": "Blood",
                    "tissue_sample_type": "Blood",
                    "dataset_type": "WGS",
                    "condition": "GermLine",
                    "sequencing_date": "2020-12-17",
                },
                {
                    "family_codename": "1001",
                    "participant_codename": "3420",
                    "tissue_sample": "Blood",
                    "tissue_sample_type": "Blood",
                    "dataset_type": "WES",
                    "condition": "GermLine",
                    "sequencing_date": "2020-12-17",
                },
            ],
        ).status_code
        == 200
    )
    # Test csv
    goodcsv = open("tests/samplecsv.csv", "r")
    assert (
        client.post(
            "/api/_bulk?groups=ach",
            data=goodcsv.read(),
            headers={"Content-Type": "text/csv"},
        ).status_code
        == 200
    )

    # Test sequencing_date is provided
    assert (
        client.post(
            "/api/_bulk",
            json=[
                {
                    "family_codename": "1001",
                    "participant_codename": "1411",
                    "tissue_sample": "Blood",
                    "tissue_sample_type": "Blood",
                    "dataset_type": "WGS",
                    "condition": "GermLine",
                },
                {
                    "family_codename": "1001",
                    "participant_codename": "3420",
                    "tissue_sample": "Blood",
                    "tissue_sample_type": "Blood",
                    "dataset_type": "WES",
                    "condition": "GermLine",
                },
            ],
        ).status_code
        == 400
    )

    # Test invalid group query
    assert (
        client.post(
            "/api/_bulk?groups=torgen&",
            json=[
                {
                    "family_codename": "1001",
                    "participant_codename": "1411",
                    "tissue_sample": "Blood",
                    "tissue_sample_type": "Blood",
                    "dataset_type": "WGS",
                    "condition": "GermLine",
                    "sequencing_date": "2020-12-17",
                }
            ],
        ).status_code
        == 404
    )

    # Test correct permission group
    response = client.post(
        "/api/_bulk?groups=ach",
        json=[
            {
                "family_codename": "1001",
                "participant_codename": "1411",
                "tissue_sample": "Blood",
                "tissue_sample_type": "Blood",
                "dataset_type": "WGS",
                "condition": "GermLine",
                "sequencing_date": "2020-12-17",
            }
        ],
    )

    assert response.status_code == 200
    # check that dataset is linked to group specified in query
    dataset = response.get_json()
    dataset_id = dataset[0]["dataset_id"]
    dataset_group = (
        models.Dataset.query.join(models.Dataset.groups)
        .filter(
            models.Group.group_code == "ach", models.Dataset.dataset_id == dataset_id
        )
        .one_or_none()
    )
    assert dataset_group is not None

    # Test no permission group specified but belongs to multiple groups
    assert (
        client.post(
            "/api/_bulk",
            json=[
                {
                    "family_codename": "1001",
                    "participant_codename": "1411",
                    "tissue_sample": "Blood",
                    "tissue_sample_type": "Blood",
                    "dataset_type": "WGS",
                    "condition": "GermLine",
                    "sequencing_date": "2020-12-17",
                }
            ],
        ).status_code
        == 400
    )

    # Check db for both csv result and json array result

    family = (
        models.Family.query.options(joinedload(models.Family.participants))
        .filter(models.Family.family_codename == "1001")
        .one_or_none()
    )
    assert family is not None
    assert len(family.participants) == 2

    # part = (
    #     models.Participant.query
    #     .filter(models.Participant.participant_codename == "06332")
    #     .one_or_none()
    # )
    # assert part.created is None

    family = (
        models.Family.query.options(joinedload(models.Family.participants))
        .filter(models.Family.family_codename == "FAM01")
        .one_or_none()
    )
    assert family is not None
    assert len(family.participants) == 3

    random_participant = (
        models.Participant.query.options(
            joinedload(models.Participant.tissue_samples).joinedload(
                models.TissueSample.datasets
            )
        )
        .filter(models.Participant.participant_codename == "PTP02")
        .one_or_none()
    )
    assert random_participant is not None
    assert len(random_participant.tissue_samples) == 1
    assert len(random_participant.tissue_samples[0].datasets) == 1


def test_post_bulk_user(test_database, client, login_as):
    login_as("user")
    # Test allowed permission groups
    assert (
        client.post(
            "/api/_bulk?groups=ach",
            json=[
                {
                    "family_codename": "1001",
                    "participant_codename": "1411",
                    "tissue_sample": "Blood",
                    "tissue_sample_type": "Blood",
                    "dataset_type": "WGS",
                    "condition": "GermLine",
                    "sequencing_date": "2020-12-17",
                }
            ],
        ).status_code
        == 200
    )
    # Test no group query parameter, but user only belongs to one group
    assert (
        client.post(
            "/api/_bulk",
            json=[
                {
                    "family_codename": "1001",
                    "participant_codename": "1411",
                    "tissue_sample": "Blood",
                    "tissue_sample_type": "Blood",
                    "dataset_type": "WGS",
                    "condition": "GermLine",
                    "sequencing_date": "2020-12-17",
                }
            ],
        ).status_code
        == 200
    )
    login_as("user_b")
    # Test no permission groups
    assert (
        client.post(
            "/api/_bulk?groups=ach",
            json=[
                {
                    "family_codename": "1001",
                    "participant_codename": "1411",
                    "tissue_sample": "Blood",
                    "tissue_sample_type": "Blood",
                    "dataset_type": "WGS",
                    "condition": "GermLine",
                    "sequencing_date": "2020-12-17",
                }
            ],
        ).status_code
        == 404
    )
    login_as("user_a")
    # Test multiple permission groups, none specified
    assert (
        client.post(
            "/api/_bulk",
            json=[
                {
                    "family_codename": "1001",
                    "participant_codename": "1411",
                    "tissue_sample": "Blood",
                    "tissue_sample_type": "Blood",
                    "dataset_type": "WGS",
                    "condition": "GermLine",
                    "sequencing_date": "2020-12-17",
                }
            ],
        ).status_code
        == 400
    )

    # Test multiple permission groups, one specified
    assert (
        client.post(
            "/api/_bulk?groups=ach",
            json=[
                {
                    "family_codename": "1001",
                    "participant_codename": "1411",
                    "tissue_sample": "Blood",
                    "tissue_sample_type": "Blood",
                    "dataset_type": "WGS",
                    "condition": "GermLine",
                    "sequencing_date": "2020-12-17",
                }
            ],
        ).status_code
        == 200
    )


def test_bulk_multiple_csv(test_database, client, login_as):
    login_as("admin")

    assert (
        client.post(
            "/api/_bulk?groups=ach",
            data="""
family_codename,participant_codename,participant_type,tissue_sample_type,dataset_type,sex,condition,sequencing_date,linked_files,notes
HOOD,HERO,Proband,Saliva,WGS,Female,GermLine,2020-12-17,/path/foo|/path/bar||,
HOOD,HERO,Proband,Saliva,WGS,Female,GermLine,2020-12-17,/path/yeet|/path/cross|/foo/bar,three
""",
            headers={"Content-Type": "text/csv"},
        ).status_code
        == 200
    )

    for dataset in models.Dataset.query.all():
        print(dataset)
    assert models.Dataset.query.count() == 6
    assert models.File.query.count() == 5
    assert models.TissueSample.query.count() == 5
    assert models.Participant.query.count() == 4
    assert models.Family.query.count() == 3


def test_bulk_multiple_json(test_database, client, login_as):
    login_as("admin")

    assert (
        client.post(
            "/api/_bulk?groups=ach",
            json=[
                {
                    "family_codename": "HOOD",
                    "participant_codename": "HERO",
                    "participant_type": "Proband",
                    "tissue_sample_type": "Saliva",
                    "dataset_type": "WGS",
                    "sex": "Female",
                    "condition": "GermLine",
                    "sequencing_date": "2020-12-17",
                    "linked_files": [
                        {"path": "/otonashi/yuzuru", "path": "/tachibana/kanade"}
                    ],
                },
                {
                    "family_codename": "HOOD",
                    "participant_codename": "HERO",
                    "participant_type": "Proband",
                    "tissue_sample_type": "Saliva",
                    "dataset_type": "WES",
                    "sex": "Female",
                    "condition": "GermLine",
                    "sequencing_date": "2020-12-17",
                    "linked_files": [
                        {"path": "/perfectly/balanced"},
                        {"path": "/as/all/things/should/be"},
                    ],
                },
            ],
        ).status_code
        == 200
    )

    assert models.Dataset.query.count() == 6
    assert models.File.query.count() == 3
    assert models.TissueSample.query.count() == 5
    assert models.Participant.query.count() == 4
    assert models.Family.query.count() == 3


def test_fails_with_dupe_non_multiplex_fields(test_database):
    """will upload fail if we try to link a non-multiplexed file multiple times?"""

    csv = StringIO(
        """family_codename,participant_codename,participant_type,tissue_sample_type,dataset_type,sex,condition,sequencing_date,linked_files,notes
    HOOD,HERO,Proband,Saliva,WGS,Female,GermLine,2020-12-17,/path/foo|/path/bar"""
    )

    file = models.File(path="/path/foo", multiplexed=False)
    db.session.add(file)

    row = next(DictReader(csv))

    dataset = models.Dataset()

    mock_request = Mock(spec=Request)
    mock_request.content_type = "text/csv"

    with raises(Exception) as e:
        link_files_to_dataset(mock_request, dataset, row)

    assert "already linked" in str(e.value)


def test_can_add_existing_with_multiplex_flag(test_database):
    """can we specify a path to an existing file if the multiplex flag is set?"""

    file = models.File(path="/path/foo", multiplexed=True)
    db.session.add(file)

    row = {
        "family_codename": "HOOD",
        "participant_codename": "HERO",
        "participant_type": "Proband",
        "tissue_sample_type": "Saliva",
        "dataset_type": "WES",
        "sex": "Female",
        "condition": "GermLine",
        "sequencing_date": "2020-12-17",
        "linked_files": [
            {"path": "/path/foo", "multiplexed": True},
        ],
    }

    dataset = models.Dataset()

    mock_request = Mock(spec=Request)
    mock_request.content_type = "appliction/json"

    result = link_files_to_dataset(mock_request, dataset, row)

    assert len(result.linked_files) == 1


def test_can_mark_multiplex_with_asterisk(test_database):
    """does the asterisk as multiplex indicator for csv uploads work?"""

    csv = StringIO(
        """family_codename,participant_codename,participant_type,tissue_sample_type,dataset_type,sex,condition,sequencing_date,linked_files,notes
    HOOD,HERO,Proband,Saliva,WGS,Female,GermLine,2020-12-17,*/path/foo|/path/bar"""
    )

    row = next(DictReader(csv))

    dataset = models.Dataset()

    mock_request = Mock(spec=Request)
    mock_request.content_type = "text/csv"

    result = link_files_to_dataset(mock_request, dataset, row)

    assert len(result.linked_files) == 2
    assert len([f for f in result.linked_files if f.multiplexed]) == 1
