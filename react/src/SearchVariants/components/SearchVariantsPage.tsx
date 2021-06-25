import React, { useEffect, useState } from "react";
import { Button, Chip, Container, Grid, makeStyles, Typography } from "@material-ui/core";
import { useSnackbar } from "notistack";
import { useDownloadCsv, useModalState } from "../../hooks";
import { GeneAlias } from "../../typings";
import GeneAutocomplete from "./Autocomplete";
import { CardButton } from "./CardButton";
import { ReportColumnModal } from "./ReportColumnModal";

interface SearchVariantsPageProps {}

const useStyles = makeStyles(theme => ({
    appBarSpacer: theme.mixins.toolbar,
    content: {
        flexGrow: 1,
        height: "100vh",
        overflow: "auto",
    },
    container: {
        marginTop: theme.spacing(3),
        marginBottom: theme.spacing(3),
    },
    chip: {
        margin: theme.spacing(1),
        paddingTop: theme.spacing(3),
        paddingBottom: theme.spacing(3),
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(1),
    },
}));

const GET_VARIANTS_SUMMARY_URL = "/api/summary/variants";

const GET_VARIANTS_BY_PARTICIPANTS_SUMMARY_URL = "/api/summary/participants";

// TODO: Get this list from the backend instead
const temporaryListOfReportColumns = [
    "AA_position",
    "Alt",
    "Alt_depths.401_130105S",
    "Alt_depths.401_13_0451",
    "Burden.401_130105S",
    "Burden.401_13_0451",
    "Cadd_score",
    "Clinvar",
    "Conserved_in_20_mammals",
    "Depth",
    "Ensembl_gene_id",
    "Ensembl_transcript_id",
    "Exac_pli_score",
    "Exac_pnull_score",
    "Exac_prec_score",
    "Exon",
    "Frequency_in_C4R",
    "GNOMAD_Link",
    "Gene",
    "Gene_description",
    "Gerp_score",
    "Gnomad_ac",
    "Gnomad_af",
    "Gnomad_af_popmax",
    "Gnomad_hom",
    "Gnomad_oe_lof_score",
    "Gnomad_oe_mis_score",
    "gts",
    "HGMD_gene",
    "HGMD_id",
    "HGMD_ref",
    "HGMD_tag",
    "Imprinting_expressed_allele",
    "Imprinting_status",
    "Info",
    "Number_of_callers",
    "Old_multiallelic",
    "Omim_gene_description",
    "Omim_inheritance",
    "Orphanet",
    "Polyphen_score",
    "Position",
    "Protein_domains",
    "Pseudoautosomal",
    "Quality",
    "Ref",
    "Refseq_change",
    "Revel_score",
    "rsIDs",
    "Seen_in_C4R_samples",
    "Sift_score",
    "Splicing",
    "Trio_coverage",
    "UCSC_Link",
    "Variation",
    "Vest3_score",
    "Zygosity.401_130105S",
    "Zygosity.401_13_0451",
];

const SearchVariantsPage: React.FC<SearchVariantsPageProps> = () => {
    const loadSavedArray = (key: string) => {
        const stored = localStorage.getItem(key);
        if (stored === null) return null;
        try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                return parsed;
            } else {
                console.warn(`Invalid localStorage format for '${key}'.`, stored);
                localStorage.removeItem(key);
                return null;
            }
        } catch (error) {
            console.warn(`Invalid localStorage format for '${key}'.`, stored);
            localStorage.removeItem(key);
            return null;
        }
    };

    const { enqueueSnackbar } = useSnackbar();

    const [selectedGenes, setSelectedGenes] = useState<GeneAlias[]>(
        loadSavedArray("gene-panel") || []
    );
    const [downloadType, setDownloadType] = useState<"variant" | "participant">("variant");
    const [columns, setColumns] = useState<string[]>(() => {
        const array = loadSavedArray("report-columns");
        if (array) {
            return (array as string[]).filter(col => temporaryListOfReportColumns.includes(col));
        }
        return temporaryListOfReportColumns;
    });
    const columnModal = useModalState(false);

    const updateColumns = (action: React.SetStateAction<string[]>) => {
        if (typeof action === "function") {
            let newColumns: string[] = [];
            const newAction = (prev: string[]) => {
                const columns = action(prev);
                newColumns = columns;
                return columns;
            };
            setColumns(newAction);
            localStorage.setItem("report-columns", JSON.stringify(newColumns));
        } else {
            setColumns(action);
            localStorage.setItem("report-columns", JSON.stringify(action));
        }
    };

    const toggleGeneSelection = (gene: GeneAlias) => {
        const updated = !selectedGenes.includes(gene)
            ? selectedGenes.concat(gene)
            : selectedGenes.filter(g => g !== gene);
        setSelectedGenes(updated);
        localStorage.setItem("gene-panel", JSON.stringify(updated));
    };

    const onError = async (response: Response) => {
        try {
            const payload = await response.json();
            enqueueSnackbar(`${response.status} ${response.statusText}: ${payload.error}`);
        } catch (error) {
            console.error(error, response);
            enqueueSnackbar(`${response.status} ${response.statusText}`);
        }
    };

    const downloadVariantwiseCsv = useDownloadCsv(GET_VARIANTS_SUMMARY_URL, {
        onError,
    });

    const downloadParticipantwiseCsv = useDownloadCsv(GET_VARIANTS_BY_PARTICIPANTS_SUMMARY_URL, {
        onError,
    });

    const downloadCsv = () => {
        const panel = selectedGenes.map(gene => `ENSG${gene.ensembl_id}`).join(",");
        if (downloadType === "participant") {
            return downloadParticipantwiseCsv({ panel });
        }
        return downloadVariantwiseCsv({ panel });
    };

    useEffect(() => {
        document.title = `Search Variants | ${process.env.REACT_APP_NAME}`;
    }, []);

    const classes = useStyles();

    const disableControls = !selectedGenes.length;

    return (
        <>
            <main className={classes.content}>
                <div className={classes.appBarSpacer} />
                <Container className={classes.container} maxWidth={false}>
                    <Grid spacing={3} direction="column" container alignItems="center">
                        <Grid item xs={12}>
                            <Typography align="center" variant="h3">
                                Search for Variants
                            </Typography>
                        </Grid>
                        <Grid
                            container
                            justify="center"
                            alignItems="center"
                            spacing={1}
                            item
                            xs={12}
                            md={6}
                            wrap="nowrap"
                        >
                            <Grid item xs={12}>
                                <GeneAutocomplete fullWidth={true} onSelect={toggleGeneSelection} />
                            </Grid>
                            <Grid item>
                                <Button
                                    disabled={disableControls}
                                    onClick={downloadCsv}
                                    size="large"
                                    variant="contained"
                                >
                                    Download
                                </Button>
                            </Grid>
                        </Grid>
                        <Grid container item xs={12} md={6} spacing={1}>
                            <Grid container item xs={6}>
                                <CardButton
                                    title="Variant-wise Report"
                                    description="Each row is identified by a unique variant. If multiple participants have the same variant, column fields such as codename, depth, or zygosity are concatenated into a single list -- delimited by ';' -- for that variant's row."
                                    selected={downloadType === "variant"}
                                    onClick={() => setDownloadType("variant")}
                                    disabled={disableControls}
                                />
                            </Grid>
                            <Grid container item xs={6}>
                                <CardButton
                                    title="Participant-wise Report"
                                    description="Each row is identified by a participant's variant. Every column field is a single value, and variants may occur more than once if more than one participant has that variant."
                                    selected={downloadType === "participant"}
                                    onClick={() => setDownloadType("participant")}
                                    disabled={disableControls}
                                />
                            </Grid>
                            {process.env.NODE_ENV === "development" && (
                                // TODO: Remove dev-only rendering when endpoint is updated to accept report columns
                                <Grid item xs={12}>
                                    <Typography variant="h6">Add/Remove columns</Typography>
                                    <Button variant="contained" onClick={columnModal.onOpen}>
                                        Open Modal
                                    </Button>
                                </Grid>
                            )}
                        </Grid>
                        <Grid container item xs={12} md={6} wrap="nowrap">
                            <Grid item>
                                {!!selectedGenes.length && <Typography>Selected Genes</Typography>}
                            </Grid>
                            <Grid item container xs={12}>
                                {selectedGenes.map(g => (
                                    <Grid item key={g.name}>
                                        <Chip
                                            className={classes.chip}
                                            label={
                                                <>
                                                    <b>{g.name}</b>
                                                    <br />
                                                    <small>
                                                        ENSG{`${g.ensembl_id}`.padStart(11, "0")}
                                                    </small>
                                                </>
                                            }
                                            onDelete={() => toggleGeneSelection(g)}
                                        />
                                    </Grid>
                                ))}
                            </Grid>
                        </Grid>
                    </Grid>
                </Container>
            </main>
            <ReportColumnModal
                open={columnModal.open}
                onClose={columnModal.onClose}
                selectedColumns={columns}
                allColumns={temporaryListOfReportColumns}
                setSelected={updateColumns}
            />
        </>
    );
};

export default SearchVariantsPage;
