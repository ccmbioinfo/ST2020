""" test gene api endpoings """
from csv import reader
from app import db
from app.models import Gene


def setup_db():
    """ seed db with minimal data """
    db.session.add(
        Gene(
            hgnc_gene_id=1,
            hgnc_gene_name="FOOBAR",
            ensembl_id=1000,
        )
    )
    db.session.commit()


def test_fetch_genes_json(test_database, client, login_as):
    """ can we fetch genes as json? """
    setup_db()
    login_as("user")
    response = client.get("/api/summary/genes", headers={"Accept": "*/*"})
    assert response.status_code == 200
    assert len(response.get_json()["data"]) == 1
    assert response.get_json()["total_count"] == 1


def test_fetch_genes_csv(test_database, client, login_as):
    """ can we fetch genes as csv? """
    setup_db()
    login_as("user")
    response = client.get("/api/summary/genes", headers={"Accept": "text/csv"})
    assert response.status_code == 200
    assert response.headers["Content-Type"] == "text/csv"
    rows = []

    gene_reader = reader(response.data.decode().split("\n"))
    for row in gene_reader:
        rows.append(row)
    dct = dict(zip(rows[0], rows[1]))
    assert dct["gene_id"] == "1"
    assert dct["hgnc_gene_name"] == "FOOBAR"
    assert dct["ensembl_id"] == "1000"


def test_search_genes(client, test_database, login_as):
    """ can we filter genes based on a search string? """
    setup_db()
    login_as("user")
    response = client.get(
        "/api/summary/genes?search=FOO", headers={"Accept": "application/json"}
    )
    assert response.status_code == 200
    assert len(response.get_json()["data"]) == 1

    no_response = client.get(
        "/api/summary/genes?search=FOOZ", headers={"Accept": "application/json"}
    )
    assert no_response.status_code == 200
    assert len(no_response.get_json()["data"]) == 0
    assert no_response.get_json()["total_count"] == 0


def test_fetch_gene_by_hgnc_id(client, test_database, login_as):
    """ can we fetch a gene by hgnc gene id """
    setup_db()
    login_as("user")
    response = client.get("/api/summary/genes/hgnc/1")
    assert response.status_code == 200
    assert response.get_json()["hgnc_gene_id"] == 1

    no_response = client.get("/api/summary/genes/hgnc/2")
    assert no_response.status_code == 404


def test_fetch_gene_by_hgnc_name(client, test_database, login_as):
    """ can we fetch a gene by hgnc gene name """
    setup_db()
    login_as("user")
    response = client.get("/api/summary/genes/FOOBAR")
    assert response.status_code == 200
    assert response.get_json()["hgnc_gene_id"] == 1

    no_response = client.get("/api/summary/genes/hgnc/BARBAR")
    assert no_response.status_code == 404


def test_fetch_gene_by_ensembl_id(client, test_database, login_as):
    """ can we fetch a gene by ensembl id """
    setup_db()
    login_as("user")
    response = client.get("/api/summary/genes/ensg/1000")
    assert response.status_code == 200
    assert response.get_json()["ensembl_id"] == 1000

    no_response = client.get("/api/summary/genes/ensg/5")
    assert no_response.status_code == 404
