import pytest
from app import db, models
from sqlalchemy.orm import joinedload

# Tests

# GET /api/analyses


def test_no_analyses(test_database, client, login_as):
    login_as("admin")

    response = client.get("/api/analyses?user=5")
    assert response.status_code == 200
    assert len(response.get_json()["data"]) == 0


def test_list_analyses_admin(test_database, client, login_as):
    login_as("admin")

    response = client.get("/api/analyses")
    assert response.status_code == 200
    assert len(response.get_json()["data"]) == 3


def test_list_analyses_user(test_database, client, login_as):
    login_as("user")

    response = client.get("/api/analyses")
    assert response.status_code == 200
    # Check number of analyses
    assert len(response.get_json()["data"]) == 1


def test_list_analyses_user_from_admin(test_database, client, login_as):
    # Repeat above test from admin's eyes
    login_as("admin")

    response = client.get("/api/analyses?user=2")
    assert response.status_code == 200
    # Check number of analyses
    assert len(response.get_json()["data"]) == 1


# GET /api/analyses/:id


def test_get_analysis(test_database, client, login_as):
    # Test invalid analysis_id
    login_as("admin")
    assert client.get("/api/analyses/4").status_code == 404
    # Test wrong permissions
    login_as("user")
    assert client.get("/api/analyses/3").status_code == 404

    # Test and validate success based on user's permissions
    login_as("user")
    response = client.get("/api/analyses/2")
    assert response.status_code == 200
    # Check number of participants in response
    assert len(response.get_json()["datasets"]) == 2
    for dataset in response.get_json()["datasets"]:
        assert dataset["dataset_type"] == "WGS"
        assert dataset["family_codename"] == "A"
        assert dataset["dataset_id"] == 2 or dataset["dataset_id"] == 3
        if dataset["dataset_id"] == 2:
            assert dataset["participant_codename"] == "001"
        if dataset["dataset_id"] == 3:
            assert dataset["participant_codename"] == "002"


# DELETE /api/analyses/:id


def test_delete_analysis(test_database, client, login_as):
    # Test without permission
    login_as("user")
    response = client.delete("/api/analyses/1")
    assert response.status_code == 401

    # Test with wrong id
    login_as("admin")
    response = client.delete("/api/analyses/4")
    assert response.status_code == 404

    # Standard test
    login_as("admin")
    assert client.delete("/api/analyses/1").status_code == 204
    # Make sure it's gone
    response2 = client.get("/api/analyses")
    assert response2.status_code == 200
    assert len(response2.get_json()["data"]) == 2


# PATCH /api/analyses/:id


def test_update_analysis(test_database, client, login_as):
    login_as("user")
    # Test existence
    assert (
        client.patch("/api/analyses/4", json={"result_path": "blank"}).status_code
        == 404
    )
    # Test permission
    assert (
        client.patch("/api/analyses/3", json={"result_path": "blank"}).status_code
        == 404
    )
    # Test assignee does not exist
    assert client.patch("/api/analyses/2", json={"assignee": "nope"}).status_code == 400

    # Test enum error - doesn't really apply anymore if we get check for valid enums separately
    assert (
        client.patch("/api/analyses/2", json={"priority": "not_an_enum"}).status_code
        == 400
    )
    # test analysis state restriction for users
    for state in ["Requested", "Running", "Done", "Error"]:
        assert (
            client.patch("/api/analyses/2", json={"analysis_state": state}).status_code
            == 403
        )
    # test success for cancellation
    assert (
        client.patch(
            "/api/analyses/2", json={"analysis_state": "Cancelled"}
        ).status_code
        == 200
    )

    # test analysis state restriction (no restriction) for admins
    login_as("admin")
    for state in ["Requested", "Running", "Done", "Error", "Cancelled"]:
        assert (
            client.patch("/api/analyses/1", json={"analysis_state": state}).status_code
            == 200
        )
        analysis = models.Analysis.query.filter(
            models.Analysis.analysis_id == 1
        ).one_or_none()
        assert analysis.analysis_state == state


# POST /api/analyses


def test_create_analysis(test_database, client, login_as):
    login_as("user")
    # Test no pipeline id given
    assert (
        client.post(
            "/api/analyses",
            json={"datasets": "haha"},
        ).status_code
        == 400
    )
    # Test no dataset id given
    assert (
        client.post(
            "/api/analyses",
            json={"pipeline_id": "haha"},
        ).status_code
        == 400
    )

    # # Test invalid dataset id given
    assert (
        client.post(
            "/api/analyses", json={"datasets": "haha", "pipeline_id": 1}
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/analyses", json={"datasets": [], "pipeline_id": 1}
        ).status_code
        == 400
    )

    # Test invalid pipeline id given
    assert (
        client.post(
            "/api/analyses", json={"datasets": [1, 2], "pipeline_id": "lol nah"}
        ).status_code
        == 400
    )

    # Test invalid invalid priority given
    assert (
        client.post(
            "/api/analyses",
            json={"datasets": [3], "pipeline_id": 2, "priority": "FOO"},
        ).status_code
        == 400
    )

    # test requesting a dataset that the user does not have access to
    assert (
        client.post(
            "/api/analyses", json={"datasets": [1, 2], "pipeline_id": 1}
        ).status_code
        == 404
    )

    # Test success and check db (dataset 3 is compatible with pipeline 1)
    assert (
        client.post(
            "/api/analyses", json={"datasets": [3], "pipeline_id": 1}
        ).status_code
        == 201
    )
    analysis = (
        models.Analysis.query.options(joinedload(models.Analysis.datasets))
        .filter(models.Analysis.analysis_id == 4)
        .one_or_none()
    )
    dataset_3 = (
        models.Dataset.query.options(joinedload(models.Dataset.analyses))
        .filter(models.Dataset.dataset_id == 3)
        .one_or_none()
    )
    assert analysis is not None
    assert len(analysis.datasets) == 1
    assert len(dataset_3.analyses) == 2

    login_as("admin")
    assert len(client.get("/api/analyses").get_json()["data"]) == 4

    # test compatible metadataset types - may need to expand on these after more pipelines are introduced

    test_compatible_dict = {
        "wes_crg_1": ([4], 1, 404),  # Fail
        "wes_cre_1": ([4], 2, 201),  # Pass
        "wes_crg_2": ([1], 1, 404),  # Fail
        "wes_cre_2": ([1], 2, 201),  # Pass
        "wgs_crg": ([3], 1, 201),  # Pass
        "wgs_cre": ([3], 2, 404),  # Fail
        "wgs_crg_2": ([2], 1, 201),  # Pass
        "wgs_cre_2": ([2], 2, 404),  # Fail
        "multi_crg_bad": ([3, 4], 1, 404),  # Fail
        "multi_cre_good": ([1, 4], 2, 201),  # Pass
    }

    for key in test_compatible_dict:
        dataset_ids, pipeline_id, expected_error_code = test_compatible_dict[key]
        assert (
            client.post(
                "/api/analyses",
                json={"datasets": dataset_ids, "pipeline_id": pipeline_id},
            ).status_code
            == expected_error_code
        )
