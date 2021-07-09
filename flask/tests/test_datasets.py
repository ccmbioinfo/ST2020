import pytest

from sqlalchemy.orm import joinedload

from app import db, models, tissue_samples
from app.datasets import update_dataset_linked_files


# TODO: some tests do not precisely verify response structure


def test_list_datasets_admin(client, test_database, login_as):
    """
    GET /api/datasets as an administrator
    """
    login_as("admin")

    # Retrieve all datasets as admin
    response = client.get("/api/datasets")
    assert response.status_code == 200
    body = response.get_json()
    assert body["page"] == 0
    assert len(body["data"]) == body["total_count"] == 4

    # Assume user identity belonging to no groups
    response = client.get("/api/datasets?user=1")
    assert response.status_code == 200
    body = response.get_json()
    assert body["page"] == 0
    assert len(body["data"]) == body["total_count"] == 0

    # Assume user identity belonging to a group with limited visibility
    response = client.get("/api/datasets?user=2")
    assert response.status_code == 200
    body = response.get_json()
    assert body["page"] == 0
    assert len(body["data"]) == body["total_count"] == 2

    # Assume nonexistent user identity
    response = client.get("/api/datasets?user=400")
    assert response.status_code == 200
    body = response.get_json()
    assert body["page"] == 0
    assert len(body["data"]) == body["total_count"] == 0


def test_list_datasets_user(client, test_database, login_as):
    """
    GET /api/datasets as a regular user
    """
    login_as("user")

    # Retrieve all datasets I can access
    response = client.get("/api/datasets")
    assert response.status_code == 200
    body = response.get_json()
    assert body["page"] == 0
    assert len(body["data"]) == body["total_count"] == 2

    # Cannot assume another user's identity, query string ignored
    response = client.get("/api/datasets?user=1")
    assert response.status_code == 200
    body = response.get_json()
    assert body["page"] == 0
    assert len(body["data"]) == body["total_count"] == 2

    response = client.get("/api/datasets?user=2")
    assert response.status_code == 200
    body = response.get_json()
    assert body["page"] == 0
    assert len(body["data"]) == body["total_count"] == 2

    response = client.get("/api/datasets?user=400")
    assert response.status_code == 200
    body = response.get_json()
    assert body["page"] == 0
    assert len(body["data"]) == body["total_count"] == 2


def test_get_dataset_admin(client, test_database, login_as):
    """
    GET /api/datasets/:id as an administrator
    """
    login_as("admin")

    # Retrieve all datasets as an admin
    for i in range(1, 5):
        # Retrieve as an admin
        response = client.get(f"/api/datasets/{i}")
        assert response.status_code == 200
        dataset = response.get_json()
        assert dataset["dataset_id"] == i
        assert dataset["condition"] == "Somatic"
        assert dataset["created_by"] == "admin"
        assert dataset["updated_by"] == "admin"

        # Assume user identity belonging to no groups
        assert client.get(f"/api/datasets/{i}?user=1").status_code == 404

        # Assume nonexistent user identity
        assert client.get(f"/api/datasets/{i}?user=400").status_code == 404

    # Assume user identity belonging to a group with limited visibility
    assert client.get(f"/api/datasets/1?user=2").status_code == 404
    assert client.get(f"/api/datasets/2?user=2").status_code == 200
    assert client.get(f"/api/datasets/3?user=2").status_code == 200
    assert client.get(f"/api/datasets/4?user=2").status_code == 404


def test_get_dataset_user(client, test_database, login_as):
    """
    GET /api/datasets/:id as a regular user
    """
    login_as("user")

    # Cannot assume another user's identity, query string ignored
    for query in ["", "?user=1", "?user=2"]:
        assert client.get(f"/api/datasets/1{query}").status_code == 404
        assert client.get(f"/api/datasets/2{query}").status_code == 200
        assert client.get(f"/api/datasets/3{query}").status_code == 200
        assert client.get(f"/api/datasets/4{query}").status_code == 404


def test_update_dataset_admin(client, test_database, login_as):
    """
    PATCH /api/datasets/:id as an administrator
    """
    login_as("admin")

    # Nonexistent
    assert client.patch("/api/datasets/400", json={"foo": "bar"}).status_code == 404
    # Assume user identity that does not have permission
    assert (
        client.patch("/api/datasets/2?user=1", json={"foo": "bar"}).status_code == 404
    )

    # Bad dataset_type
    assert (
        client.patch("/api/datasets/2", json={"dataset_type": "foo"}).status_code == 400
    )

    unaffected = [{"tissue_sample_id": 12}, {"analyses": []}]
    for body in unaffected:
        response = client.patch("/api/datasets/2", json=body)
        assert response.status_code == 200
        dataset = response.get_json()
        for key, value in body.items():
            assert key not in dataset or dataset[key] != value

    changes = [
        {"notes": "stop the count"},
        {
            "dataset_type": "WES",
            "linked_files": [{"path": "/path/to/file", "multiplexed": False}],
        },
    ]
    for body in changes:
        response = client.patch("/api/datasets/2", json=body)
        assert response.status_code == 200
        dataset = response.get_json()
        for key, value in body.items():
            assert dataset[key] == value


def test_update_dataset_user(client, test_database, login_as):
    """
    PATCH /api/datasets/:id as a regular user
    """
    login_as("user")

    # Nonexistent
    assert client.patch("/api/datasets/400", json={"foo": "bar"}).status_code == 404
    # No permission
    assert client.patch("/api/datasets/1", json={"foo": "bar"}).status_code == 404

    changes = [
        {"notes": "stop the count"},
        {
            "dataset_type": "WES",
            "linked_files": [{"path": "/path/to/file", "multiplexed": False}],
        },
    ]
    for body in changes:
        response = client.patch("/api/datasets/2", json=body)
        assert response.status_code == 200
        dataset = response.get_json()
        assert dataset["updated_by"] == "user"
        for key, value in body.items():
            assert dataset[key] == value


def test_delete_dataset_admin(client, test_database, login_as):
    """
    DELETE /api/datasets/:id as an administrator
    """
    login_as("admin")

    # Deleting a dataset with analyses
    assert client.delete("/api/datasets/1").status_code == 422
    assert client.get("/api/datasets/1").status_code == 200

    dataset = (
        models.Dataset.query.filter(models.Dataset.dataset_id == 1)
        .options(
            joinedload(models.Dataset.analyses)
            .joinedload(models.Analysis.genotype)
            .joinedload(models.Genotype.variant)
        )
        .one_or_none()
    )

    for analysis in dataset.analyses:
        for genotype in analysis.genotype:
            db.session.delete(genotype)
        db.session.commit()
        for variant in analysis.variants:
            db.session.delete(variant)
        db.session.delete(analysis)
    db.session.commit()

    assert client.delete("/api/datasets/1").status_code == 204
    assert client.get("/api/datasets/1").status_code == 404

    # Deleting a nonexistent dataset
    assert client.delete("/api/datasets/400").status_code == 404
    assert client.get("/api/datasets/400").status_code == 404


def test_delete_dataset_user(client, test_database, login_as):
    """
    DELETE /api/datasets/:id as a regular user
    """
    login_as("user")

    # Regular users cannot delete
    assert client.delete("/api/datasets/2").status_code == 401
    assert client.get("/api/datasets/2").status_code == 200

    # Regular users cannot ascertain the existence of datasets by trying to delete
    assert client.delete("/api/datasets/1").status_code == 401
    assert client.get("/api/datasets/1").status_code == 404
    assert client.delete("/api/datasets/400").status_code == 401
    assert client.get("/api/datasets/400").status_code == 404


def test_create_dataset(client, test_database, login_as):
    """
    POST /api/dataset as an administrator
    """
    login_as("admin")

    invalid_requests = [
        {"wait it's all 400 bad request": "always has been"},
        # Missing fields
        {"dataset_type": "foo"},
        {"tissue_sample_id": "foo"},
        {"dataset_type": "WGS", "tissue_sample_id": 1},
        # Bad dataset_type
        {"dataset_type": "foo", "tissue_sample_id": 1},
    ]
    for body in invalid_requests:
        assert client.post("/api/datasets", json=body).status_code == 400

    # Nonexistent tissue sample
    assert (
        client.post(
            "/api/datasets",
            json={
                "dataset_type": "foo",
                "sequencing_date": "2020-12-04",
                "tissue_sample_id": "foo",
            },
        ).status_code
        == 404
    )
    assert (
        client.post(
            "/api/datasets",
            json={
                "dataset_type": "foo",
                "sequencing_date": "2020-12-04",
                "tissue_sample_id": 400,
            },
        ).status_code
        == 404
    )
    # No sequencing date
    assert (
        client.post(
            "/api/datasets", json={"dataset_type": "WGS", "tissue_sample_id": 1}
        ).status_code
        == 400
    )

    # Successful minimal create
    response = client.post(
        "/api/datasets",
        json={
            "dataset_type": "WGS",
            "tissue_sample_id": 1,
            "condition": "Somatic",
            "sequencing_date": "2020-12-04",
        },
    )
    assert response.status_code == 201
    dataset = response.get_json()
    assert dataset["dataset_type"] == "WGS"
    assert dataset["tissue_sample_id"] == 1
    assert dataset["created_by"] == "admin"
    assert dataset["updated_by"] == "admin"
    assert "created" in dataset and "updated" in dataset

    endpoint = f"/api/datasets/{dataset['dataset_id']}"
    assert response.location.endswith(endpoint)
    assert client.get(endpoint).status_code == 200


def test_unauthenticated(client, test_database):
    """
    Try to access all /api/datasets without signing in
    """
    unauthorized = [
        client.get("/api/datasets"),
        client.post("/api/datasets"),
        client.get("/api/datasets/1"),
        client.get("/api/datasets/400"),  # does not exist
        client.patch("/api/datasets/1"),
        client.patch("/api/datasets/400"),  # does not exist
        client.delete("/api/datasets/1"),
        client.delete("/api/datasets/400"),  # does not exist
    ]
    not_found = [
        client.get("/api/datasets/foo"),
        client.patch("/api/datasets/foo"),
        client.post("/api/datasets/foo"),
        client.put("/api/datasets/foo"),
        client.delete("/api/datasets/foo"),
    ]
    method_not_allowed = [
        client.put("/api/datasets"),
        client.patch("/api/datasets"),
        client.delete("/api/datasets"),
        client.post("/api/datasets/1"),
        client.post("/api/datasets/400"),
        client.put("/api/datasets/1"),
        client.put("/api/datasets/400"),
    ]
    for response in unauthorized:
        assert response.status_code == 401
    for response in not_found:
        assert response.status_code == 404
    for response in method_not_allowed:
        assert response.status_code == 405


@pytest.fixture
def dataset_relationships(test_database):
    user = models.User(
        username="local_test_user", email="test_user@example.com", password_hash="123"
    )
    db.session.add(user)
    db.session.commit()

    group = models.Group(group_code="local", group_name="local")
    group2 = models.Group(group_code="local2", group_name="local2")

    family = models.Family(
        family_codename="test",
        created_by_id=user.user_id,
        updated_by_id=user.user_id,
    )

    participant = models.Participant(
        participant_codename="test",
        sex=models.Sex.Female,
        participant_type=models.ParticipantType.Proband,
        institution_id=1,
        created_by_id=user.user_id,
        updated_by_id=user.user_id,
    )

    family.participants.append(participant)

    sample = models.TissueSample(
        tissue_sample_type=models.TissueSampleType.Blood,
        created_by_id=user.user_id,
        updated_by_id=user.user_id,
    )

    participant.tissue_samples.append(sample)

    dataset_fields = {
        "dataset_type": "WES",
        "condition": models.DatasetCondition.Somatic,
        "created_by_id": user.user_id,
        "updated_by_id": user.user_id,
        "notes": "test_dataset_counts",
    }

    dataset_1 = models.Dataset(**dataset_fields)
    dataset_2 = models.Dataset(**dataset_fields)

    # each dataset has 2 groups -- with a direct join on groups, this will lead to inaccurate result count
    # when `limit` is provided
    dataset_1.groups.extend([group, group2])
    dataset_2.groups.extend([group, group2])
    sample.datasets.extend([dataset_1, dataset_2])
    db.session.add(dataset_1)
    db.session.add(dataset_2)
    db.session.commit()

    # confirm that there are 2 models in the database meeting these conditions
    # `notes` constraint excludes global test datasets from results
    assert (
        models.Dataset.query.filter(
            models.Dataset.notes == "test_dataset_counts"
        ).count()
        == 2
    )


def test_dataset_count_with_many_related_models(
    client, test_database, login_as, dataset_relationships
):
    """
    test that [GET] datasests count is true count of dataset models matching criteria
    and `limit` does not count rows created by join to related models, in this case `groups`
    """
    login_as("admin")

    response = client.get("/api/datasets?notes=test_dataset_counts&limit=2")
    assert response.status_code == 200
    body = response.get_json()

    # confirm that our result count matches database count
    assert len(body["data"]) == 2


def test_dataset_filter_on_dataset_column(
    client, test_database, login_as, dataset_relationships
):
    login_as("admin")

    # wrong format
    # ignore irrelevant parameters
    response = client.get("/api/datasets?fake_column=something_fake")
    assert response.status_code == 200

    # improper format of relevant parameters
    response = client.get("/api/datasets?condition=25")
    assert response.status_code == 400

    # correct format
    response = client.get("/api/datasets?notes=test_dataset_counts&dataset_type=WES")
    assert response.status_code == 200
    assert len(response.get_json()["data"]) == 2

    response = client.get("/api/datasets?notes=test_dataset_counts&dataset_type=RES")
    assert response.status_code == 200
    assert len(response.get_json()["data"]) == 0


def test_dataset_filter_on_related_column(
    client, test_database, login_as, dataset_relationships
):
    login_as("admin")

    # check join with participant
    response = client.get(
        "/api/datasets?notes=test_dataset_counts&participant_codename=test"
    )
    assert response.status_code == 200
    assert len(response.get_json()["data"]) == 2

    response = client.get(
        "/api/datasets?notes=test_dataset_counts&participant_codename=doesntexisthaha"
    )
    assert response.status_code == 200
    assert len(response.get_json()["data"]) == 0

    # check join with family
    response = client.get(
        "/api/datasets?notes=test_dataset_counts&family_codename=test"
    )
    assert response.status_code == 200
    assert len(response.get_json()["data"]) == 2

    response = client.get(
        "/api/datasets?notes=test_dataset_counts&family_codename=heygottem"
    )
    assert response.status_code == 200
    assert len(response.get_json()["data"]) == 0

    # check join with tissue sample
    response = client.get(
        "/api/datasets?notes=test_dataset_counts&tissue_sample_type=Blood"
    )
    assert response.status_code == 200
    assert len(response.get_json()["data"]) == 2

    response = client.get(
        "/api/datasets?notes=test_dataset_counts&tissue_sample_type=Urine"
    )
    assert response.status_code == 200
    assert len(response.get_json()["data"]) == 0


def test_dataset_order_by_dataset_column(client, test_database, login_as):
    login_as("admin")

    # wrong format
    response = client.get("/api/datasets?order_by=nothing")
    assert response.status_code == 400

    response = client.get("/api/datasets?order_by=dataset_type&order_dir=upsidedown")
    assert response.status_code == 400

    # correct format
    response = client.get("/api/datasets?order_by=dataset_type&order_dir=asc")
    assert response.status_code == 200
    body = response.get_json()
    assert len(body["data"]) == 4
    assert body["data"][0]["dataset_type"] == body["data"][1]["dataset_type"] == "WES"

    response = client.get("/api/datasets?order_by=dataset_type&order_dir=desc")
    assert response.status_code == 200
    body = response.get_json()
    assert len(body["data"]) == 4
    assert body["data"][0]["dataset_type"] == body["data"][1]["dataset_type"] == "WGS"


def test_dataset_order_by_related_column(client, test_database, login_as):
    login_as("admin")

    # check join with participant
    response = client.get("/api/datasets?order_by=participant_codename&order_dir=asc")
    assert response.status_code == 200
    body = response.get_json()
    assert len(body["data"]) == 4
    assert body["data"][0]["participant_codename"] == "001"

    response = client.get("/api/datasets?order_by=participant_codename&order_dir=desc")
    assert response.status_code == 200
    body = response.get_json()
    assert len(body["data"]) == 4
    assert body["data"][0]["participant_codename"] == "003"

    # check join with family
    response = client.get("/api/datasets?order_by=family_codename&order_dir=asc")
    assert response.status_code == 200
    body = response.get_json()
    assert len(body["data"]) == 4
    assert (
        body["data"][0]["family_codename"] == body["data"][1]["family_codename"] == "A"
    )

    response = client.get("/api/datasets?order_by=family_codename&order_dir=desc")
    assert response.status_code == 200
    body = response.get_json()
    assert len(body["data"]) == 4
    assert body["data"][0]["family_codename"] == "B"

    # check join with tissue sample
    response = client.get("/api/datasets?order_by=tissue_sample_type&order_dir=asc")
    assert response.status_code == 200
    body = response.get_json()
    assert len(body["data"]) == 4
    assert body["data"][0]["tissue_sample_type"] == "Blood"

    response = client.get("/api/datasets?order_by=tissue_sample_type&order_dir=desc")
    assert response.status_code == 200
    body = response.get_json()
    assert len(body["data"]) == 4
    assert body["data"][0]["tissue_sample_type"] == "Blood"


def test_orphan_nonmultiplexed_files_deleted(test_database):
    path_name = "test_orphan_nonmultiplexed_files_deleted"
    file = models.File(path=path_name)
    db.session.add(file)
    db.session.commit()

    assert models.File.query.filter(models.File.path == path_name).count() == 1

    dataset = models.Dataset(
        tissue_sample_id=1,
        dataset_type="RES",
        condition="Control",
        created_by_id=1,
        updated_by_id=1,
    )
    dataset.linked_files.append(file)

    dataset = update_dataset_linked_files(dataset, [{"path": "new_path"}])

    assert len(dataset.linked_files) == 1
    assert models.File.query.filter(models.File.path == path_name).count() == 0


def test_orphan_multiplexed_files_with_multiple_datasets_attached_not_deleted(
    test_database,
):
    path_name = "test_orphan_nonmultiplexed_files_deleted"
    file = models.File(path=path_name, multiplexed=True)
    db.session.add(file)
    db.session.commit()

    assert models.File.query.filter(models.File.path == path_name).count() == 1

    dataset = models.Dataset(
        tissue_sample_id=1,
        dataset_type="RES",
        condition="Control",
        created_by_id=1,
        updated_by_id=1,
    )

    dataset_2 = models.Dataset(
        tissue_sample_id=1,
        dataset_type="RES",
        condition="Control",
        created_by_id=1,
        updated_by_id=1,
    )

    dataset.linked_files.append(file)
    dataset_2.linked_files.append(file)

    dataset = update_dataset_linked_files(dataset, [{"path": "new_path"}])

    assert len(dataset.linked_files) == 1
    assert models.File.query.filter(models.File.path == path_name).count() == 1
